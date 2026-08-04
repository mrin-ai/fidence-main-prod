import { randomBytes } from "crypto";
import type { ObjectId } from "mongodb";

import type { ComplianceActor } from "@/lib/compliance/actor";
import type { PolicyCode } from "@/lib/compliance/codes";
import type { PolicyVerdict } from "@/lib/compliance/evaluate-policy";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { ensureComplianceIndexes } from "@/lib/db/compliance-indexes";
import type { PolicyDecisionDoc } from "@/lib/db/compliance-types";

export function generateDecisionReceiptId() {
  return `dec_${randomBytes(8).toString("hex")}`;
}

export async function recordPolicyDecision(input: {
  workspaceId: ObjectId;
  action: string;
  verdict: PolicyVerdict | "recorded";
  codes?: Array<PolicyCode | string>;
  policyVersion?: number | null;
  policyId?: string | null;
  amountUsd?: number;
  networkId?: string;
  tokenId?: string;
  requestId?: string;
  agentId?: ObjectId;
  agentPublicId?: string;
  externalAgentId?: string;
  actor: ComplianceActor;
  note?: string;
}): Promise<{ receiptId: string }> {
  await ensureComplianceIndexes();

  if (!input.actor?.ip) {
    throw new Error("ComplianceActor.ip is required for policy decisions");
  }

  const receiptId = generateDecisionReceiptId();
  const now = new Date();
  const doc: PolicyDecisionDoc = {
    receiptId,
    workspaceId: input.workspaceId,
    action: input.action,
    verdict: input.verdict,
    codes: input.codes ?? [],
    policyVersion: input.policyVersion ?? null,
    policyId: input.policyId ?? null,
    amountUsd: input.amountUsd,
    networkId: input.networkId,
    tokenId: input.tokenId,
    requestId: input.requestId,
    agentId: input.agentId,
    agentPublicId: input.agentPublicId,
    externalAgentId: input.externalAgentId,
    actor: {
      ...input.actor,
      ip: input.actor.ip || "unknown",
    },
    createdAt: now,
    note: input.note,
  };

  const db = await getDb();
  await db.collection<PolicyDecisionDoc>(COLLECTIONS.policyDecisions).insertOne(doc);
  return { receiptId };
}

export async function listAgentPolicyDecisions(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  limit?: number;
}) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  return db
    .collection<PolicyDecisionDoc>(COLLECTIONS.policyDecisions)
    .find({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function queryPolicyDecisions(input: {
  workspaceId: ObjectId;
  from?: Date;
  to?: Date;
  ip?: string;
  actorType?: string;
  agentId?: ObjectId;
  limit?: number;
}) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const filter: Record<string, unknown> = {
    workspaceId: input.workspaceId,
  };

  if (input.from || input.to) {
    filter.createdAt = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }
  if (input.ip) filter["actor.ip"] = input.ip;
  if (input.actorType) filter["actor.actorType"] = input.actorType;
  if (input.agentId) filter.agentId = input.agentId;

  return db
    .collection<PolicyDecisionDoc>(COLLECTIONS.policyDecisions)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
