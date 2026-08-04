import { ObjectId } from "mongodb";

import type { ComplianceActor } from "@/lib/compliance/actor";
import { COMPLIANCE_DECISION_ACTIONS } from "@/lib/compliance/actions";
import {
  isCatalogNetworkId,
  isCatalogTokenId,
} from "@/lib/compliance/catalog";
import { POLICY_CODES } from "@/lib/compliance/codes";
import type { AgentPolicy, AgentPolicyInput } from "@/lib/compliance/types";
import { WIDE_OPEN_DAILY_CAP } from "@/lib/compliance/types";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { ensureComplianceIndexes } from "@/lib/db/compliance-indexes";
import type { AgentPolicyDoc } from "@/lib/db/compliance-types";
import type { AgentDoc } from "@/lib/db/merchant-types";
import { recordPolicyDecision } from "@/lib/db/policy-decisions";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext } from "@/lib/db/merchant-types";

export function policyDocToApi(doc: AgentPolicyDoc): AgentPolicy & {
  policyVersion: number;
  externalAgentId: string;
  publicId: string;
} {
  return {
    agentId: doc.agentId.toString(),
    status: doc.status,
    maxAmountPerPayment: doc.maxAmountPerPayment,
    dailySpendCap: doc.dailySpendCap,
    monthlySpendCap: doc.monthlySpendCap,
    allowedNetworkIds: doc.allowedNetworkIds,
    allowedTokenIds: doc.allowedTokenIds,
    allowCreatePaymentLinks: doc.allowCreatePaymentLinks,
    allowPay: doc.allowPay,
    requireApprovalAbove: doc.requireApprovalAbove,
    updatedAt: doc.updatedAt.toISOString(),
    policyVersion: doc.policyVersion,
    externalAgentId: doc.externalAgentId,
    publicId: doc.publicId,
  };
}

export function toEvaluablePolicy(doc: AgentPolicyDoc) {
  return {
    id: doc._id.toString(),
    status: doc.status,
    policyVersion: doc.policyVersion,
    maxAmountPerPayment: doc.maxAmountPerPayment,
    dailySpendCap: doc.dailySpendCap,
    monthlySpendCap: doc.monthlySpendCap,
    allowedNetworkIds: doc.allowedNetworkIds,
    allowedTokenIds: doc.allowedTokenIds,
    allowCreatePaymentLinks: doc.allowCreatePaymentLinks,
    allowPay: doc.allowPay,
    requireApprovalAbove: doc.requireApprovalAbove,
  };
}

export async function getAgentPolicy(workspaceId: ObjectId, agentId: ObjectId) {
  await ensureComplianceIndexes();
  const db = await getDb();
  return db.collection<AgentPolicyDoc>(COLLECTIONS.agentPolicies).findOne({
    workspaceId,
    agentId,
  });
}

export async function listAgentPolicies(workspaceId: ObjectId) {
  await ensureComplianceIndexes();
  const db = await getDb();
  return db
    .collection<AgentPolicyDoc>(COLLECTIONS.agentPolicies)
    .find({ workspaceId })
    .toArray();
}

export type PolicyUpsertError = {
  ok: false;
  error: string;
  code?: string;
  status: number;
};

export type PolicyUpsertOk = {
  ok: true;
  policy: AgentPolicyDoc;
  receiptId: string;
};

function validatePolicyInput(
  input: AgentPolicyInput,
  options?: { confirmWideOpen?: boolean },
): PolicyUpsertError | null {
  if (!Number.isFinite(input.maxAmountPerPayment) || input.maxAmountPerPayment <= 0) {
    return {
      ok: false,
      error: "maxAmountPerPayment must be a positive number",
      status: 400,
    };
  }
  if (!Number.isFinite(input.dailySpendCap) || input.dailySpendCap <= 0) {
    return {
      ok: false,
      error: "dailySpendCap must be a positive number",
      status: 400,
    };
  }
  if (
    input.monthlySpendCap !== null &&
    (!Number.isFinite(input.monthlySpendCap) || input.monthlySpendCap <= 0)
  ) {
    return {
      ok: false,
      error: "monthlySpendCap must be null or a positive number",
      status: 400,
    };
  }
  if (
    input.requireApprovalAbove !== null &&
    (!Number.isFinite(input.requireApprovalAbove) ||
      input.requireApprovalAbove < 0)
  ) {
    return {
      ok: false,
      error: "requireApprovalAbove must be null or a non-negative number",
      status: 400,
    };
  }
  if (!input.allowedNetworkIds.length) {
    return { ok: false, error: "Select at least one network", status: 400 };
  }
  if (!input.allowedTokenIds.length) {
    return { ok: false, error: "Select at least one token", status: 400 };
  }
  if (!input.allowCreatePaymentLinks && !input.allowPay) {
    return {
      ok: false,
      error: "Enable at least one permission",
      status: 400,
    };
  }
  for (const id of input.allowedNetworkIds) {
    if (!isCatalogNetworkId(id)) {
      return { ok: false, error: `Unknown network: ${id}`, status: 400 };
    }
  }
  for (const id of input.allowedTokenIds) {
    if (!isCatalogTokenId(id)) {
      return { ok: false, error: `Unknown token: ${id}`, status: 400 };
    }
  }
  if (
    input.dailySpendCap >= WIDE_OPEN_DAILY_CAP &&
    options?.confirmWideOpen !== true &&
    input.status === "active"
  ) {
    return {
      ok: false,
      error: "Daily spend cap is very high; confirm with confirmWideOpen: true",
      code: POLICY_CODES.CONFIRM_WIDE_OPEN_REQUIRED,
      status: 400,
    };
  }
  return null;
}

export async function upsertAgentPolicy(input: {
  workspaceId: ObjectId;
  agent: AgentDoc;
  body: AgentPolicyInput;
  actor: ComplianceActor;
  security: SecurityContext;
  confirmWideOpen?: boolean;
}): Promise<PolicyUpsertOk | PolicyUpsertError> {
  await ensureComplianceIndexes();

  const validation = validatePolicyInput(input.body, {
    confirmWideOpen: input.confirmWideOpen,
  });
  if (validation) return validation;

  const existing = await getAgentPolicy(input.workspaceId, input.agent._id);
  const now = new Date();
  const previousStatus = existing?.status;
  const nextStatus = input.body.status;
  const bumpVersion =
    !existing || nextStatus === "active" || previousStatus !== nextStatus;

  const nextVersion = existing
    ? bumpVersion
      ? existing.policyVersion + 1
      : existing.policyVersion
    : 1;

  const fields = {
    workspaceId: input.workspaceId,
    agentId: input.agent._id,
    externalAgentId: input.agent.externalAgentId,
    publicId: input.agent.publicId,
    status: nextStatus,
    policyVersion: nextVersion,
    maxAmountPerPayment: input.body.maxAmountPerPayment,
    dailySpendCap: input.body.dailySpendCap,
    monthlySpendCap: input.body.monthlySpendCap,
    allowedNetworkIds: input.body.allowedNetworkIds,
    allowedTokenIds: input.body.allowedTokenIds,
    allowCreatePaymentLinks: input.body.allowCreatePaymentLinks,
    allowPay: input.body.allowPay,
    requireApprovalAbove: input.body.requireApprovalAbove,
    updatedAt: now,
    lastUpdatedByUserId: input.actor.userId,
    lastUpdatedIp: input.actor.ip || "unknown",
    lastUpdatedAt: now,
    ...(nextStatus === "active" && previousStatus !== "active"
      ? { activatedAt: now }
      : {}),
  };

  const db = await getDb();
  const result = await db
    .collection<AgentPolicyDoc>(COLLECTIONS.agentPolicies)
    .findOneAndUpdate(
      { workspaceId: input.workspaceId, agentId: input.agent._id },
      {
        $set: fields,
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

  if (!result) {
    return { ok: false, error: "Failed to save policy", status: 500 };
  }

  let decisionAction: string = COMPLIANCE_DECISION_ACTIONS.POLICY_DRAFT_SAVED;
  let securityAction = "policy_draft_saved";
  if (nextStatus === "active" && previousStatus !== "active") {
    decisionAction = COMPLIANCE_DECISION_ACTIONS.POLICY_ACTIVATED;
    securityAction = "policy_activated";
  } else if (nextStatus === "draft" && previousStatus === "active") {
    decisionAction = COMPLIANCE_DECISION_ACTIONS.POLICY_DEACTIVATED;
    securityAction = "policy_deactivated";
  }

  const { receiptId } = await recordPolicyDecision({
    workspaceId: input.workspaceId,
    action: decisionAction,
    verdict: "recorded",
    codes: [],
    policyVersion: result.policyVersion,
    policyId: result._id.toString(),
    agentId: input.agent._id,
    agentPublicId: input.agent.publicId,
    externalAgentId: input.agent.externalAgentId,
    actor: input.actor,
  });

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: input.actor.actorType === "api_key" ? "api_key" : "user",
    actorId: input.actor.userId,
    agentId: input.agent._id,
    action: securityAction,
    resourceType: "agent_policy",
    resourceId: result._id.toString(),
    security: input.security,
  });

  return { ok: true, policy: result, receiptId };
}

export async function resolveWorkspaceAgent(
  workspaceId: ObjectId,
  agentKey: string,
) {
  const db = await getDb();
  const key = agentKey.trim();
  if (ObjectId.isValid(key) && String(new ObjectId(key)) === key) {
    const byId = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
      workspaceId,
      _id: new ObjectId(key),
    });
    if (byId) return byId;
  }

  return db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
    workspaceId,
    $or: [{ externalAgentId: key }, { publicId: key }],
  });
}
