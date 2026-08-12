import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";

import type { ComplianceActor } from "@/lib/compliance/actor";
import { systemComplianceActor } from "@/lib/compliance/actor";
import { COMPLIANCE_DECISION_ACTIONS } from "@/lib/compliance/actions";
import { evaluatePolicy } from "@/lib/compliance/evaluate-policy";
import { POLICY_CODES } from "@/lib/compliance/codes";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { ensureComplianceIndexes } from "@/lib/db/compliance-indexes";
import type {
  PaymentApprovalDoc,
  PaymentApprovalPayload,
} from "@/lib/db/compliance-types";
import { getAgentPolicy, toEvaluablePolicy } from "@/lib/db/agent-policies";
import { getAgentSpendTotals } from "@/lib/db/agent-spend";
import { recordPolicyDecision } from "@/lib/db/policy-decisions";
import { logActivity } from "@/lib/db/activity";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext, AgentDoc } from "@/lib/db/merchant-types";
import { enqueueWebhookEvent } from "@/lib/webhooks/dispatch";

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
/** Stuck pay-gate claims older than this are released back to approved (or expired). */
const CLAIM_STALE_MS = 15 * 60 * 1000;

export function generateApprovalId() {
  return `apr_${randomBytes(8).toString("hex")}`;
}

type ApprovalPayloadMatch = {
  type: "link" | "profile";
  linkUsername?: string;
  linkPublicId?: string;
  recipientUsername?: string;
  payerAddress?: string;
};

function matchesApprovalBindings(
  approval: PaymentApprovalDoc,
  input: {
    agentId: ObjectId;
    amountUsd: number;
    tokenId: string;
    networkId: string;
    payloadMatch: ApprovalPayloadMatch;
  },
) {
  if (!approval.agentId.equals(input.agentId)) {
    return { ok: false as const, error: "Approval agent mismatch", code: "APPROVAL_MISMATCH" };
  }
  if (
    approval.amountUsd !== input.amountUsd ||
    approval.tokenId !== input.tokenId ||
    approval.networkId !== input.networkId
  ) {
    return { ok: false as const, error: "Approval amount mismatch", code: "APPROVAL_MISMATCH" };
  }
  if (approval.payload.type !== input.payloadMatch.type) {
    return { ok: false as const, error: "Approval type mismatch", code: "APPROVAL_MISMATCH" };
  }
  if (
    input.payloadMatch.type === "link" &&
    (approval.payload.linkUsername !== input.payloadMatch.linkUsername ||
      approval.payload.linkPublicId !== input.payloadMatch.linkPublicId)
  ) {
    return { ok: false as const, error: "Approval link mismatch", code: "APPROVAL_MISMATCH" };
  }
  if (
    input.payloadMatch.type === "profile" &&
    approval.payload.recipientUsername !== input.payloadMatch.recipientUsername
  ) {
    return {
      ok: false as const,
      error: "Approval recipient mismatch",
      code: "APPROVAL_MISMATCH",
    };
  }
  if (
    approval.payload.payerAddress &&
    input.payloadMatch.payerAddress &&
    approval.payload.payerAddress !== input.payloadMatch.payerAddress
  ) {
    return {
      ok: false as const,
      error: "Approval payer wallet mismatch",
      code: "APPROVAL_MISMATCH",
    };
  }
  return { ok: true as const };
}

async function markExpired(doc: PaymentApprovalDoc) {
  const db = await getDb();
  const updated = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOneAndUpdate(
      { _id: doc._id, status: { $in: ["pending", "approved", "claimed"] } },
      {
        $set: {
          status: "expired",
          resolvedAt: new Date(),
          resolvedBy: systemComplianceActor(),
        },
        $unset: { claimedAt: "" },
      },
      { returnDocument: "after" },
    );

  if (updated) {
    await recordPolicyDecision({
      workspaceId: doc.workspaceId,
      action: COMPLIANCE_DECISION_ACTIONS.APPROVAL_EXPIRED,
      verdict: "recorded",
      codes: [],
      agentId: doc.agentId,
      agentPublicId: doc.agentPublicId,
      externalAgentId: doc.externalAgentId,
      actor: systemComplianceActor(),
      amountUsd: doc.amountUsd,
      networkId: doc.networkId,
      tokenId: doc.tokenId,
    });
    await logSecurityEvent({
      workspaceId: doc.workspaceId,
      actorType: "system",
      action: "payment_approval_expired",
      resourceType: "payment_approval",
      resourceId: doc.approvalId,
      security: {
        ip: "system",
        userAgent: "system",
        device: "system",
        browser: "system",
        timestamp: new Date(),
        date: new Date().toISOString().slice(0, 10),
      },
    });
    return updated;
  }

  return doc;
}

async function expireIfNeeded(doc: PaymentApprovalDoc) {
  const now = Date.now();

  if (doc.status === "claimed" && doc.claimedAt) {
    const claimedAge = now - doc.claimedAt.getTime();
    if (claimedAge > CLAIM_STALE_MS) {
      if (doc.expiresAt.getTime() <= now) {
        return markExpired(doc);
      }
      // Do not auto-release claimed approvals; pay must complete or fail explicitly.
    }
  }

  if (doc.status !== "pending" && doc.status !== "approved" && doc.status !== "claimed") {
    return doc;
  }
  if (doc.expiresAt.getTime() > now) return doc;
  return markExpired(doc);
}

export async function createPaymentApproval(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  agentPublicId: string;
  externalAgentId: string;
  payload: PaymentApprovalPayload;
  requestedBy: ComplianceActor;
  policyVersion: number | null;
  receiptId?: string;
  security: SecurityContext;
}) {
  await ensureComplianceIndexes();
  const now = new Date();
  const approvalId = generateApprovalId();
  const doc: PaymentApprovalDoc = {
    _id: new ObjectId(),
    approvalId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentPublicId: input.agentPublicId,
    externalAgentId: input.externalAgentId,
    status: "pending",
    amountUsd: input.payload.amountUsd,
    networkId: input.payload.networkId,
    tokenId: input.payload.tokenId,
    payload: input.payload,
    requestedBy: input.requestedBy,
    createdAt: now,
    expiresAt: new Date(now.getTime() + APPROVAL_TTL_MS),
    policyVersion: input.policyVersion,
    receiptId: input.receiptId,
  };

  const db = await getDb();
  await db.collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals).insertOne(doc);

  await logActivity({
    workspaceId: input.workspaceId,
    type: "approval",
    summary: `Approval requested · ${input.externalAgentId} · $${input.payload.amountUsd}`,
  });

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "agent",
    actorId: input.agentPublicId,
    agentId: input.agentId,
    action: "agent_policy_approval_required",
    resourceType: "payment_approval",
    resourceId: approvalId,
    security: input.security,
  });

  await enqueueWebhookEvent({
    workspaceId: input.workspaceId,
    event: "compliance.approval_required",
    payload: {
      approvalId,
      agentId: input.agentId.toString(),
      agentPublicId: input.agentPublicId,
      externalAgentId: input.externalAgentId,
      status: "pending",
      amountUsd: input.payload.amountUsd,
      tokenId: input.payload.tokenId,
      networkId: input.payload.networkId,
      payload: input.payload,
      poll: `/api/v1/compliance/approvals/${approvalId}`,
    },
  });

  return doc;
}

export async function getPaymentApproval(
  workspaceId: ObjectId,
  approvalId: string,
) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const doc = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOne({ workspaceId, approvalId });
  if (!doc) return null;
  return expireIfNeeded(doc);
}

export async function listPaymentApprovals(
  workspaceId: ObjectId,
  status?: string,
) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const filter: Record<string, unknown> = { workspaceId };
  if (status) filter.status = status;

  const docs = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return Promise.all(docs.map((doc) => expireIfNeeded(doc)));
}

export async function resolvePaymentApproval(input: {
  workspaceId: ObjectId;
  approvalId: string;
  decision: "approved" | "rejected";
  actor: ComplianceActor;
  security: SecurityContext;
}) {
  await ensureComplianceIndexes();
  const existing = await getPaymentApproval(input.workspaceId, input.approvalId);
  if (!existing) {
    return { ok: false as const, error: "Approval not found", status: 404 };
  }
  if (existing.status !== "pending") {
    return {
      ok: false as const,
      error: `Approval is already ${existing.status}`,
      status: 409,
      approval: existing,
    };
  }

  if (input.decision === "approved") {
    const dbForEval = await getDb();
    const agent = await dbForEval.collection<AgentDoc>(COLLECTIONS.agents).findOne({
      _id: existing.agentId,
      workspaceId: input.workspaceId,
    });
    const [policyDoc, spend] = await Promise.all([
      getAgentPolicy(input.workspaceId, existing.agentId),
      getAgentSpendTotals(input.workspaceId, existing.agentId),
    ]);
    const reEval = evaluatePolicy({
      agentStatus: agent?.status === "active" ? "active" : "inactive",
      action: existing.payload.type === "link" ? "pay.link" : "pay.profile",
      amountUsd: existing.amountUsd,
      networkId: existing.networkId,
      tokenId: existing.tokenId,
      policy: policyDoc ? toEvaluablePolicy(policyDoc) : null,
      spentDailyUsd: spend.spentDailyUsd,
      spentMonthlyUsd: spend.spentMonthlyUsd,
      approvalConsumed: true,
    });
    if (reEval.verdict === "deny") {
      return {
        ok: false as const,
        error: `Cannot approve: ${reEval.codes[0] ?? POLICY_CODES.POLICY_EVAL_ERROR}`,
        status: 403,
      };
    }
  }

  const db = await getDb();
  const now = new Date();
  const updated = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOneAndUpdate(
      { _id: existing._id, status: "pending" },
      {
        $set: {
          status: input.decision,
          resolvedBy: input.actor,
          resolvedAt: now,
        },
      },
      { returnDocument: "after" },
    );

  if (!updated) {
    return {
      ok: false as const,
      error: "Approval already resolved",
      status: 409,
    };
  }

  const { receiptId } = await recordPolicyDecision({
    workspaceId: input.workspaceId,
    action:
      input.decision === "approved"
        ? COMPLIANCE_DECISION_ACTIONS.APPROVAL_APPROVED
        : COMPLIANCE_DECISION_ACTIONS.APPROVAL_REJECTED,
    verdict: "recorded",
    codes: [],
    agentId: updated.agentId,
    agentPublicId: updated.agentPublicId,
    externalAgentId: updated.externalAgentId,
    actor: input.actor,
    amountUsd: updated.amountUsd,
    networkId: updated.networkId,
    tokenId: updated.tokenId,
  });

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.actor.userId,
    agentId: updated.agentId,
    action:
      input.decision === "approved"
        ? "payment_approval_approved"
        : "payment_approval_rejected",
    resourceType: "payment_approval",
    resourceId: updated.approvalId,
    security: input.security,
  });

  await logActivity({
    workspaceId: input.workspaceId,
    type: "approval",
    status: input.decision === "approved" ? "settled" : "blocked",
    summary: `Approval ${input.decision} · ${updated.externalAgentId} · $${updated.amountUsd}`,
  });

  return { ok: true as const, approval: updated, receiptId };
}

/**
 * Atomically claim an approved intent at pay-gate entry (approved → claimed).
 * Concurrent pays: exactly one claim wins.
 */
export async function claimPaymentApproval(input: {
  workspaceId: ObjectId;
  approvalId: string;
  agentId: ObjectId;
  amountUsd: number;
  tokenId: string;
  networkId: string;
  payloadMatch: ApprovalPayloadMatch;
}) {
  const approval = await getPaymentApproval(input.workspaceId, input.approvalId);
  if (!approval) {
    return { ok: false as const, error: "Approval not found", code: "APPROVAL_NOT_FOUND" };
  }
  if (approval.status !== "approved") {
    return {
      ok: false as const,
      error: `Approval is ${approval.status}`,
      code: "APPROVAL_NOT_USABLE",
    };
  }

  const bindings = matchesApprovalBindings(approval, input);
  if (!bindings.ok) return bindings;

  const db = await getDb();
  const claimed = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOneAndUpdate(
      {
        _id: approval._id,
        workspaceId: input.workspaceId,
        status: "approved",
      },
      { $set: { status: "claimed", claimedAt: new Date() } },
      { returnDocument: "after" },
    );

  if (!claimed) {
    return {
      ok: false as const,
      error: "Approval already claimed",
      code: "APPROVAL_NOT_USABLE",
    };
  }

  return { ok: true as const, approval: claimed };
}

export async function releasePaymentApprovalClaim(input: {
  workspaceId: ObjectId;
  approvalId: string;
}) {
  const db = await getDb();
  const released = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOneAndUpdate(
      {
        workspaceId: input.workspaceId,
        approvalId: input.approvalId,
        status: "claimed",
      },
      { $set: { status: "approved" }, $unset: { claimedAt: "" } },
      { returnDocument: "after" },
    );

  if (!released) {
    return {
      ok: false as const,
      error: "Approval claim not releasable",
      code: "APPROVAL_NOT_USABLE",
    };
  }

  return { ok: true as const, approval: released };
}

export async function drainExpiredApprovals(limit = 100) {
  await ensureComplianceIndexes();
  const db = await getDb();
  const now = new Date();
  const candidates = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .find({
      status: { $in: ["pending", "approved", "claimed"] },
      expiresAt: { $lte: now },
    })
    .limit(limit)
    .toArray();

  let expired = 0;
  for (const doc of candidates) {
    const updated = await markExpired(doc);
    if (updated.status === "expired") expired += 1;
  }

  return { processed: candidates.length, expired };
}

export async function consumePaymentApproval(input: {
  workspaceId: ObjectId;
  approvalId: string;
}) {
  const db = await getDb();
  const consumed = await db
    .collection<PaymentApprovalDoc>(COLLECTIONS.paymentApprovals)
    .findOneAndUpdate(
      {
        workspaceId: input.workspaceId,
        approvalId: input.approvalId,
        status: "claimed",
      },
      {
        $set: { status: "consumed", resolvedAt: new Date() },
        $unset: { claimedAt: "" },
      },
      { returnDocument: "after" },
    );

  if (!consumed) {
    return {
      ok: false as const,
      error: "Approval already consumed",
      code: "APPROVAL_NOT_USABLE",
    };
  }

  return { ok: true as const, approval: consumed };
}
