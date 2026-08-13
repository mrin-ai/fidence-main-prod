import { createHash, randomBytes } from "crypto";
import type { ObjectId } from "mongodb";
import nacl from "tweetnacl";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentDoc } from "@/lib/db/merchant-types";
import { logActivity } from "@/lib/db/activity";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext } from "@/lib/db/merchant-types";
import { buildPayConnectPath } from "@/lib/payment-link-url";
import {
  getAgentLinkTtlMs,
  MAX_LINKED_AGENTS_PER_WORKSPACE,
  MAX_PENDING_LINK_SESSIONS_PER_WORKSPACE,
} from "@/lib/pay/config";
import type { AgentLinkSessionDoc, AgentLinkSessionStatus } from "@/lib/pay/types";
import { registerLinkedAgent } from "@/lib/db/agents";
import {
  issueAgentScopedKey,
  revokeAgentScopedKeysForAgent,
} from "@/lib/db/api-keys";

function generateLinkId() {
  return `lnk_${randomBytes(8).toString("hex")}`;
}

function generatePollSecret() {
  return randomBytes(24).toString("hex");
}

export function hashPollSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export async function createAgentLinkSession(input: {
  publicKey: string;
  platform: string;
  agentName: string;
  description?: string;
  security: SecurityContext;
}) {
  await getDb();
  const { ensurePayIndexes } = await import("@/lib/db/pay-indexes");
  await ensurePayIndexes();

  const db = await getDb();
  const now = new Date();
  const platform = input.platform.trim().slice(0, 64);
  const agentName = input.agentName.trim().slice(0, 120);

  if (!platform || !agentName) {
    return { ok: false as const, error: "platform and agentName are required" };
  }

  if (!input.publicKey.trim()) {
    return { ok: false as const, error: "publicKey is required" };
  }

  const pendingCount = await db
    .collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions)
    .countDocuments({
      status: "pending",
      expiresAt: { $gt: now },
    });

  if (pendingCount >= MAX_PENDING_LINK_SESSIONS_PER_WORKSPACE * 100) {
    return { ok: false as const, error: "Too many pending link sessions globally" };
  }

  const linkId = generateLinkId();
  const pollSecret = generatePollSecret();
  const expiresAt = new Date(now.getTime() + getAgentLinkTtlMs());

  const doc: Omit<AgentLinkSessionDoc, "_id"> = {
    linkId,
    publicKey: input.publicKey.trim(),
    pollSecretHash: hashPollSecret(pollSecret),
    platform,
    agentName,
    description: input.description?.trim(),
    status: "pending",
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).insertOne(doc as AgentLinkSessionDoc);

  return {
    ok: true as const,
    linkId,
    pollSecret,
    connectUrl: buildPayConnectPath(linkId),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAgentLinkSession(linkId: string) {
  const db = await getDb();
  const session = await db
    .collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions)
    .findOne({ linkId });

  if (!session) return null;

  const now = new Date();
  if (session.status === "pending" && session.expiresAt <= now) {
    await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).updateOne(
      { _id: session._id, status: "pending" },
      { $set: { status: "expired", updatedAt: now } },
    );
    return { ...session, status: "expired" as AgentLinkSessionStatus };
  }

  return session;
}

export function verifyLinkPollSecret(session: AgentLinkSessionDoc, pollSecret: string) {
  return hashPollSecret(pollSecret) === session.pollSecretHash;
}

export async function pollAgentLinkSession(input: {
  linkId: string;
  pollSecret: string;
}) {
  const session = await getAgentLinkSession(input.linkId);
  if (!session) {
    return { ok: false as const, error: "Link session not found", code: "NOT_FOUND" as const };
  }

  if (!verifyLinkPollSecret(session, input.pollSecret)) {
    return { ok: false as const, error: "Invalid poll credentials", code: "FORBIDDEN" as const };
  }

  if (session.status === "pending") {
    return {
      ok: true as const,
      status: "pending" as const,
      linkId: session.linkId,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  if (session.status === "expired" || session.status === "rejected" || session.status === "cancelled") {
    return {
      ok: true as const,
      status: session.status,
      linkId: session.linkId,
    };
  }

  if (session.status === "approved" && session.agentObjectId && session.workspaceId) {
    let scopedKey: string | null = null;
    if (!session.scopedKeyDeliveredAt && session.apiKeyId) {
      const keyResult = await deliverScopedKeyOnce(session);
      scopedKey = keyResult.plaintextKey;
    }

    const db = await getDb();
    const agent = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
      _id: session.agentObjectId,
    });

    return {
      ok: true as const,
      status: "approved" as const,
      linkId: session.linkId,
      agent: agent
        ? {
            id: agent._id.toString(),
            publicId: agent.publicId,
            externalAgentId: agent.externalAgentId,
            name: agent.name ?? agent.externalAgentId,
          }
        : null,
      apiKey: scopedKey,
    };
  }

  return { ok: true as const, status: session.status, linkId: session.linkId };
}

async function deliverScopedKeyOnce(session: AgentLinkSessionDoc) {
  const db = await getDb();
  if (!session.apiKeyId || !session.workspaceId || !session.agentObjectId) {
    return { plaintextKey: null };
  }

  const keyDoc = await db.collection(COLLECTIONS.apiKeys).findOne({
    _id: session.apiKeyId,
  });

  if (!keyDoc || !(keyDoc as { plaintextKey?: string }).plaintextKey) {
    return { plaintextKey: null };
  }

  const plaintextKey = (keyDoc as { plaintextKey?: string }).plaintextKey!;
  await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).updateOne(
    { _id: session._id, scopedKeyDeliveredAt: { $exists: false } },
    { $set: { scopedKeyDeliveredAt: new Date(), updatedAt: new Date() } },
  );

  await db.collection(COLLECTIONS.apiKeys).updateOne(
    { _id: session.apiKeyId },
    { $unset: { plaintextKey: "" } },
  );

  return { plaintextKey };
}

export async function approveAgentLinkSession(input: {
  linkId: string;
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  const session = await getAgentLinkSession(input.linkId);
  if (!session) {
    return { ok: false as const, error: "Link session not found" };
  }

  if (session.status !== "pending") {
    return { ok: false as const, error: `Link session is ${session.status}` };
  }

  const db = await getDb();
  const pendingForWorkspace = await db
    .collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions)
    .countDocuments({
      workspaceId: input.workspaceId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

  if (pendingForWorkspace >= MAX_PENDING_LINK_SESSIONS_PER_WORKSPACE) {
    return { ok: false as const, error: "Too many pending link sessions for workspace" };
  }

  const linkedCount = await db.collection(COLLECTIONS.agents).countDocuments({
    workspaceId: input.workspaceId,
    registrationSource: "linked",
    status: "active",
  });

  if (linkedCount >= MAX_LINKED_AGENTS_PER_WORKSPACE) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_LINKED_AGENTS_PER_WORKSPACE} linked agents allowed`,
      code: "LINKED_AGENT_LIMIT" as const,
    };
  }

  const externalAgentId = `linked_${session.platform}_${randomBytes(4).toString("hex")}`;

  const registered = await registerLinkedAgent({
    workspaceId: input.workspaceId,
    externalAgentId,
    name: session.agentName,
    platform: session.platform,
    linkSessionId: session.linkId,
    security: input.security,
  });

  if (!registered.ok) {
    return registered;
  }

  const keyIssued = await issueAgentScopedKey({
    workspaceId: input.workspaceId,
    userId: input.userId,
    agentId: registered.agent._id,
    agentName: session.agentName,
    security: input.security,
    plaintextKeyStorage: true,
  });

  const now = new Date();
  await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).updateOne(
    { _id: session._id, status: "pending" },
    {
      $set: {
        status: "approved",
        workspaceId: input.workspaceId,
        agentObjectId: registered.agent._id,
        apiKeyId: keyIssued.apiKeyId,
        approvedAt: now,
        updatedAt: now,
      },
    },
  );

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.userId.toString(),
    agentId: registered.agent._id,
    action: "agent_link_approved",
    resourceType: "agent_link_session",
    resourceId: session.linkId,
    security: input.security,
  });

  await logActivity({
    workspaceId: input.workspaceId,
    type: "agent_connected",
    summary: `Agent connected · ${session.agentName} (${session.platform})`,
  });

  return {
    ok: true as const,
    agent: registered.agent,
    linkId: session.linkId,
  };
}

export async function rejectAgentLinkSession(input: {
  linkId: string;
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db
    .collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions)
    .findOneAndUpdate(
      { linkId: input.linkId, status: "pending" },
      { $set: { status: "rejected", workspaceId: input.workspaceId, updatedAt: now } },
      { returnDocument: "after" },
    );

  if (!result) {
    return { ok: false as const, error: "Link session not found or not pending" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "agent_link_expired",
    summary: `Agent link rejected · ${result.agentName}`,
  });

  return { ok: true as const };
}

export async function cancelAgentLinkSession(input: {
  linkId: string;
  pollSecret: string;
}) {
  const session = await getAgentLinkSession(input.linkId);
  if (!session) {
    return { ok: false as const, error: "Link session not found" };
  }

  if (!verifyLinkPollSecret(session, input.pollSecret)) {
    return { ok: false as const, error: "Invalid poll credentials" };
  }

  const db = await getDb();
  await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).updateOne(
    { _id: session._id, status: "pending" },
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );

  return { ok: true as const };
}

export async function disconnectLinkedAgent(input: {
  workspaceId: ObjectId;
  agentObjectId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  const db = await getDb();
  const agent = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    _id: input.agentObjectId,
    workspaceId: input.workspaceId,
    registrationSource: "linked",
  });

  if (!agent) {
    return { ok: false as const, error: "Linked agent not found" };
  }

  await revokeAgentScopedKeysForAgent({
    workspaceId: input.workspaceId,
    agentId: agent._id,
    security: input.security,
    actorUserId: input.userId.toString(),
  });

  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: agent._id },
    { $set: { status: "inactive", updatedAt: new Date() } },
  );

  await logActivity({
    workspaceId: input.workspaceId,
    type: "agent_disconnected",
    summary: `Agent disconnected · ${agent.name ?? agent.publicId}`,
  });

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.userId.toString(),
    agentId: agent._id,
    action: "agent_disconnected",
    resourceType: "agent",
    resourceId: agent._id.toString(),
    security: input.security,
  });

  return { ok: true as const };
}

export function verifyLinkSignature(
  publicKeyBase64: string,
  message: string,
  signatureBase64: string,
) {
  try {
    const publicKey = Buffer.from(publicKeyBase64, "base64");
    const signature = Buffer.from(signatureBase64, "base64");
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}

export async function expireStaleLinkSessions() {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions).updateMany(
    { status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "expired", updatedAt: now } },
  );
  return result.modifiedCount;
}
