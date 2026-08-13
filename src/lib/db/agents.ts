import { randomBytes, randomUUID } from "crypto";
import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentListItem } from "@/lib/merchant-ui-types";
import type { AgentDoc, AgentWallet } from "@/lib/db/merchant-types";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext } from "@/lib/db/merchant-types";
import { logActivity } from "@/lib/db/activity";
import { truncateAddress } from "@/lib/profile-url";
import { normalizePaymentAddress } from "@/lib/payment/normalize";
import { getWalletNetworkLabel } from "@/lib/wallet-networks";
import { walletNetworks } from "@/lib/wallet-networks";
import { listVerifiedWallets } from "@/lib/db/wallets";
import type { UserDoc } from "@/lib/db/types";

export const MAX_AGENTS_PER_WORKSPACE = 10;

function generateAgentPublicId() {
  return `agt_${randomBytes(4).toString("hex")}`;
}

function formatAgentDate(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getAgentWallets(agent: AgentDoc): AgentWallet[] {
  if (agent.wallets?.length) return agent.wallets;
  if (agent.walletAddress && agent.networkId) {
    return [
      {
        id: "legacy",
        networkId: agent.networkId,
        address: agent.walletAddress,
        addedAt: agent.registeredAt,
      },
    ];
  }
  return [];
}

export function isLinkedAgent(agent: AgentDoc) {
  return agent.registrationSource === "linked";
}

function ownerVerifiedWalletsAsAgentWallets(owner: UserDoc): AgentWallet[] {
  return listVerifiedWallets(owner).map((wallet) => ({
    id: wallet.id,
    networkId: wallet.networkId,
    address: wallet.address,
    addedAt: wallet.verifiedAt,
    verifiedAt: wallet.verifiedAt,
    verificationMethod:
      wallet.verificationMethod === "solana" ? ("solana" as const) : ("eip191" as const),
  }));
}

/** Payer wallets for pay preflight/settlement — linked agents fall back to workspace owner /wallets. */
export function getAgentPayerWallets(agent: AgentDoc, owner?: UserDoc | null): AgentWallet[] {
  const onAgent = getAgentWallets(agent);
  if (onAgent.length > 0) return onAgent;
  if (isLinkedAgent(agent) && owner) {
    return ownerVerifiedWalletsAsAgentWallets(owner);
  }
  return [];
}

export async function listWorkspaceAgents(
  workspaceId: ObjectId,
  options?: { registrationSource?: "api" | "linked" },
): Promise<AgentListItem[]> {
  const db = await getDb();
  const filter: Record<string, unknown> = { workspaceId };
  if (options?.registrationSource) {
    filter.registrationSource = options.registrationSource;
  } else {
    filter.$or = [
      { registrationSource: { $exists: false } },
      { registrationSource: "api" },
    ];
  }

  const agents = await db
    .collection<AgentDoc>(COLLECTIONS.agents)
    .find(filter)
    .sort({ lastActiveAt: -1 })
    .toArray();

  return agents.map((agent) => {
    const wallets = getAgentWallets(agent);
    return {
      id: agent._id.toString(),
      publicId: agent.publicId,
      externalAgentId: agent.externalAgentId,
      name: agent.name ?? agent.externalAgentId,
      walletAddress: agent.walletAddress ?? wallets[0]?.address ?? null,
      networkId: agent.networkId ?? wallets[0]?.networkId ?? null,
      walletCount: wallets.length,
      status: agent.status,
      linksCreated: agent.linksCreated,
      amountPaid: agent.amountPaid,
      amountReceived: agent.amountReceived,
      registeredAtLabel: formatAgentDate(agent.registeredAt),
      lastActiveAtLabel: formatAgentDate(agent.lastActiveAt),
    };
  });
}

export async function getAgentByExternalId(
  workspaceId: ObjectId,
  externalAgentId: string,
) {
  const db = await getDb();
  return db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    workspaceId,
    externalAgentId: externalAgentId.trim(),
  });
}

export async function requireActiveAgent(
  workspaceId: ObjectId,
  externalAgentId: string,
) {
  const agent = await getAgentByExternalId(workspaceId, externalAgentId);
  if (!agent) {
    return { ok: false as const, error: "Agent not registered", code: "AGENT_NOT_FOUND" as const };
  }
  if (agent.status !== "active") {
    return { ok: false as const, error: "Agent is disabled", code: "AGENT_INACTIVE" as const };
  }
  return { ok: true as const, agent };
}

export async function registerAgent(input: {
  workspaceId: ObjectId;
  externalAgentId: string;
  name: string;
  security: SecurityContext;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedExternalId = input.externalAgentId.trim();
  const name = input.name.trim();

  if (!normalizedExternalId) {
    return { ok: false as const, error: "agentId is required" };
  }

  if (!name) {
    return { ok: false as const, error: "agentName is required" };
  }

  const existing = await getAgentByExternalId(
    input.workspaceId,
    normalizedExternalId,
  );

  if (existing) {
    return {
      ok: false as const,
      error: "Agent already registered",
      code: "AGENT_EXISTS" as const,
      agent: existing,
    };
  }

  const agentCount = await db
    .collection<AgentDoc>(COLLECTIONS.agents)
    .countDocuments({ workspaceId: input.workspaceId });

  if (agentCount >= MAX_AGENTS_PER_WORKSPACE) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_AGENTS_PER_WORKSPACE} agents allowed per workspace`,
      code: "AGENT_LIMIT_REACHED" as const,
    };
  }

  let publicId = generateAgentPublicId();
  while (
    await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({ publicId })
  ) {
    publicId = generateAgentPublicId();
  }

  const doc: Omit<AgentDoc, "_id"> = {
    workspaceId: input.workspaceId,
    externalAgentId: normalizedExternalId,
    publicId,
    name,
    wallets: [],
    status: "active",
    registrationSource: "api",
    linksCreated: 0,
    amountPaid: 0,
    amountReceived: 0,
    registeredAt: now,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.agents).insertOne(doc);
  const agent = { ...doc, _id: result.insertedId };

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "agent",
    actorId: publicId,
    agentId: result.insertedId,
    action: "agent_registered",
    resourceType: "agent",
    resourceId: result.insertedId.toString(),
    security: input.security,
  });

  await logActivity({
    workspaceId: input.workspaceId,
    type: "agent_registered",
    summary: `Agent registered · ${publicId}`,
  });

  return { ok: true as const, agent, created: true as const };
}

export async function registerLinkedAgent(input: {
  workspaceId: ObjectId;
  externalAgentId: string;
  name: string;
  platform: string;
  linkSessionId: string;
  security: SecurityContext;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedExternalId = input.externalAgentId.trim();
  const name = input.name.trim();

  if (!normalizedExternalId || !name) {
    return { ok: false as const, error: "Invalid linked agent payload" };
  }

  const existing = await getAgentByExternalId(
    input.workspaceId,
    normalizedExternalId,
  );

  if (existing) {
    return {
      ok: false as const,
      error: "Agent already registered",
      code: "AGENT_EXISTS" as const,
      agent: existing,
    };
  }

  const linkedCount = await db.collection(COLLECTIONS.agents).countDocuments({
    workspaceId: input.workspaceId,
    registrationSource: "linked",
    status: "active",
  });

  const { MAX_LINKED_AGENTS_PER_WORKSPACE } = await import("@/lib/pay/config");
  if (linkedCount >= MAX_LINKED_AGENTS_PER_WORKSPACE) {
    return {
      ok: false as const,
      error: `Maximum ${MAX_LINKED_AGENTS_PER_WORKSPACE} linked agents allowed`,
      code: "LINKED_AGENT_LIMIT" as const,
    };
  }

  let publicId = generateAgentPublicId();
  while (
    await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({ publicId })
  ) {
    publicId = generateAgentPublicId();
  }

  const doc: Omit<AgentDoc, "_id"> = {
    workspaceId: input.workspaceId,
    externalAgentId: normalizedExternalId,
    publicId,
    name,
    wallets: [],
    status: "active",
    registrationSource: "linked",
    platform: input.platform.trim(),
    linkSessionId: input.linkSessionId,
    linkedAt: now,
    linksCreated: 0,
    amountPaid: 0,
    amountReceived: 0,
    registeredAt: now,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.agents).insertOne(doc);
  const agent = { ...doc, _id: result.insertedId };

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.security.ip,
    agentId: result.insertedId,
    action: "agent_linked",
    resourceType: "agent",
    resourceId: result.insertedId.toString(),
    security: input.security,
  });

  return { ok: true as const, agent, created: true as const };
}

export async function listLinkedAgents(workspaceId: ObjectId) {
  const db = await getDb();
  const workspace = await db.collection(COLLECTIONS.workspaces).findOne({ _id: workspaceId });
  const owner = workspace
    ? await db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: workspace.ownerId })
    : null;

  const agents = await db
    .collection<AgentDoc>(COLLECTIONS.agents)
    .find({
      workspaceId,
      registrationSource: "linked",
    })
    .sort({ linkedAt: -1, lastActiveAt: -1 })
    .toArray();

  return agents.map((agent) => {
    const wallets = getAgentPayerWallets(agent, owner);
    return {
      id: agent._id.toString(),
      publicId: agent.publicId,
      externalAgentId: agent.externalAgentId,
      name: agent.name ?? agent.externalAgentId,
      platform: agent.platform,
      status: agent.status,
      defaultPayerWalletId: agent.defaultPayerWalletId,
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        networkId: wallet.networkId,
        address: wallet.address,
        verifiedAt: wallet.verifiedAt?.toISOString(),
      })),
      linkedAt: agent.linkedAt?.toISOString(),
      lastActiveAt: agent.lastActiveAt.toISOString(),
    };
  });
}

export async function getLinkedAgentById(
  workspaceId: ObjectId,
  agentObjectId: ObjectId,
) {
  const db = await getDb();
  return db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    _id: agentObjectId,
    workspaceId,
    registrationSource: "linked",
  });
}

export async function setLinkedAgentDefaultWallet(input: {
  workspaceId: ObjectId;
  agentObjectId: ObjectId;
  walletId: string;
}) {
  const agent = await getLinkedAgentById(input.workspaceId, input.agentObjectId);
  if (!agent) {
    return { ok: false as const, error: "Linked agent not found" };
  }

  const wallets = getAgentWallets(agent);
  if (!wallets.some((wallet) => wallet.id === input.walletId)) {
    return { ok: false as const, error: "Wallet not found on agent" };
  }

  const db = await getDb();
  const now = new Date();
  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: agent._id },
    { $set: { defaultPayerWalletId: input.walletId, updatedAt: now } },
  );

  return { ok: true as const };
}

export async function addAgentWallet(input: {
  workspaceId: ObjectId;
  externalAgentId: string;
  walletAddress: string;
  networkId: string;
  security: SecurityContext;
}) {
  const active = await requireActiveAgent(input.workspaceId, input.externalAgentId);
  if (!active.ok) return active;

  const db = await getDb();
  const now = new Date();
  const normalizedAddress = normalizePaymentAddress(
    input.walletAddress,
    input.networkId,
  );
  const wallets = getAgentWallets(active.agent);
  const alreadyAdded = wallets.some(
    (wallet) =>
      wallet.networkId === input.networkId &&
      normalizePaymentAddress(wallet.address, input.networkId) ===
        normalizedAddress,
  );

  if (alreadyAdded) {
    await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
      { _id: active.agent._id },
      { $set: { lastActiveAt: now, updatedAt: now } },
    );
    return { ok: true as const, agent: active.agent, created: false as const };
  }

  const nextWallet: AgentWallet = {
    id: randomUUID(),
    networkId: input.networkId,
    address: normalizedAddress,
    addedAt: now,
  };

  const nextWallets = [...wallets.filter((wallet) => wallet.id !== "legacy"), nextWallet];

  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: active.agent._id },
    {
      $set: {
        wallets: nextWallets,
        walletAddress: normalizedAddress,
        networkId: input.networkId,
        lastActiveAt: now,
        updatedAt: now,
      },
    },
  );

  const updated = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    _id: active.agent._id,
  });

  if (!updated) {
    return { ok: false as const, error: "Failed to update agent wallet" };
  }

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "agent",
    actorId: updated.publicId,
    agentId: updated._id,
    action: "agent_wallet_added",
    resourceType: "agent",
    resourceId: updated._id.toString(),
    security: input.security,
  });

  return { ok: true as const, agent: updated, created: true as const };
}

export async function getAgentProfile(
  workspaceId: ObjectId,
  externalAgentId: string,
) {
  const agent = await getAgentByExternalId(workspaceId, externalAgentId);
  if (!agent) return null;

  const wallets = getAgentWallets(agent).map((wallet) => ({
    id: wallet.id,
    networkId: wallet.networkId,
    networkLabel: getWalletNetworkLabel(wallet.networkId),
    address: wallet.address,
    addedAt: wallet.addedAt.toISOString(),
  }));

  return {
    publicId: agent.publicId,
    externalAgentId: agent.externalAgentId,
    name: agent.name ?? agent.externalAgentId,
    status: agent.status,
    wallets,
    supportedNetworks: walletNetworks.map((network) => ({
      id: network.id,
      label: network.label,
      testnet: network.testnet,
      paymentEnabled: network.paymentEnabled,
    })),
    stats: {
      linksCreated: agent.linksCreated,
      amountPaid: agent.amountPaid,
      amountReceived: agent.amountReceived,
    },
    registeredAt: agent.registeredAt.toISOString(),
    lastActiveAt: agent.lastActiveAt.toISOString(),
  };
}

export function agentHasWallet(
  agent: AgentDoc,
  walletAddress: string,
  networkId: string,
  owner?: UserDoc | null,
) {
  const normalized = normalizePaymentAddress(walletAddress, networkId);
  return getAgentPayerWallets(agent, owner).some(
    (wallet) =>
      wallet.networkId === networkId &&
      normalizePaymentAddress(wallet.address, networkId) === normalized,
  );
}

export async function setAgentStatus(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  status: AgentDoc["status"];
  security: SecurityContext;
  actorUserId: string;
}) {
  const db = await getDb();
  const now = new Date();

  const result = await db.collection<AgentDoc>(COLLECTIONS.agents).findOneAndUpdate(
    { _id: input.agentId, workspaceId: input.workspaceId },
    { $set: { status: input.status, updatedAt: now } },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Agent not found" };
  }

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.actorUserId,
    agentId: result._id,
    action: input.status === "active" ? "agent_enabled" : "agent_disabled",
    resourceType: "agent",
    resourceId: result._id.toString(),
    security: input.security,
  });

  await logActivity({
    workspaceId: input.workspaceId,
    type:
      input.status === "active"
        ? "agent_enabled"
        : "agent_disabled",
    summary: `Agent ${input.status === "active" ? "enabled" : "disabled"} · ${result.publicId}`,
  });

  return { ok: true as const, agent: result };
}

export async function incrementAgentLinkCount(agentId: ObjectId, count = 1) {
  const db = await getDb();
  const now = new Date();

  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: agentId },
    {
      $inc: { linksCreated: count },
      $set: { lastActiveAt: now, updatedAt: now },
    },
  );
}

export async function incrementAgentPaymentStats(
  agentId: ObjectId,
  input: { paid?: number; received?: number },
) {
  const db = await getDb();
  const now = new Date();
  const increment: Record<string, number> = {};

  if (input.paid) increment.amountPaid = input.paid;
  if (input.received) increment.amountReceived = input.received;

  if (Object.keys(increment).length === 0) return;

  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: agentId },
    {
      $inc: increment,
      $set: { lastActiveAt: now, updatedAt: now },
    },
  );
}

export function formatAgentWalletLabel(address?: string | null) {
  if (!address) return "—";
  return truncateAddress(address, 6);
}
