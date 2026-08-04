import type { ObjectId } from "mongodb";

import type { ComplianceActor } from "@/lib/compliance/actor";
import { POLICY_CODES, policyDeniedMessage } from "@/lib/compliance/codes";
import { isComplianceEnforcementEnabled } from "@/lib/compliance/enforcement";
import {
  evaluatePolicy,
  type EvaluatePolicyAction,
  type EvaluatePolicyResult,
} from "@/lib/compliance/evaluate-policy";
import { toPolicyAmountUsd } from "@/lib/compliance/valuation";
import { guardAgentAction } from "@/lib/compliance/content-guard";
import {
  getAgentPolicy,
  toEvaluablePolicy,
} from "@/lib/db/agent-policies";
import {
  getAgentOutstandingLinkExposureUsd,
  getAgentSpendTotals,
} from "@/lib/db/agent-spend";
import { recordPolicyDecision } from "@/lib/db/policy-decisions";
import { logActivity } from "@/lib/db/activity";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext } from "@/lib/db/merchant-types";
import type { AgentDoc } from "@/lib/db/merchant-types";

export type EvaluateAndRecordInput = {
  workspaceId: ObjectId;
  agent: AgentDoc;
  action: EvaluatePolicyAction;
  amount: number;
  tokenId: string;
  networkId: string;
  actor: ComplianceActor;
  security: SecurityContext;
  approvalConsumed?: boolean;
  /** Skip writing receipt on allow (used for preflight allow). */
  skipReceiptOnAllow?: boolean;
  requestId?: string;
  contentGuardArgs?: unknown;
  /**
   * Override outstanding unpaid-link USD (batch simulates running total).
   * When omitted, create actions load from DB.
   */
  outstandingUsd?: number;
};

export type EvaluateAndRecordResult = EvaluatePolicyResult & {
  receiptId: string | null;
  amountUsd: number | null;
  bypassed: boolean;
};

function decisionActionFor(action: EvaluatePolicyAction) {
  return action;
}

export function policyDeniedResponse(
  result: EvaluateAndRecordResult,
  status = 403,
) {
  const code = result.codes[0] ?? POLICY_CODES.POLICY_EVAL_ERROR;
  return Response.json(
    {
      ok: false,
      error: "POLICY_DENIED",
      code,
      codes: result.codes,
      receiptId: result.receiptId,
      message: policyDeniedMessage(code as typeof POLICY_CODES.NO_ACTIVE_POLICY),
    },
    { status },
  );
}

export async function evaluateAndRecordPolicy(
  input: EvaluateAndRecordInput,
): Promise<EvaluateAndRecordResult> {
  const valuation = toPolicyAmountUsd(input.amount, input.tokenId);
  if (!valuation.ok) {
    const { receiptId } = await recordPolicyDecision({
      workspaceId: input.workspaceId,
      action: decisionActionFor(input.action),
      verdict: "deny",
      codes: [valuation.code],
      amountUsd: undefined,
      networkId: input.networkId,
      tokenId: input.tokenId,
      agentId: input.agent._id,
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
      actor: input.actor,
      requestId: input.requestId,
    });

    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: input.agent.publicId,
      agentId: input.agent._id,
      action: "agent_policy_denied",
      resourceType: "compliance",
      resourceId: receiptId,
      security: input.security,
    });

    await logActivity({
      workspaceId: input.workspaceId,
      type: "blocked",
      status: "blocked",
      summary: `Agent ${input.agent.externalAgentId} blocked · ${valuation.code}`,
    });

    return {
      verdict: "deny",
      codes: [valuation.code],
      policyVersion: null,
      policyId: null,
      receiptId,
      amountUsd: null,
      bypassed: false,
    };
  }

  const guard = await guardAgentAction({
    toolName: input.action,
    args: input.contentGuardArgs ?? {
      amount: input.amount,
      tokenId: input.tokenId,
      networkId: input.networkId,
      agentId: input.agent.externalAgentId,
    },
  });

  if (guard.classification === "block") {
    const { receiptId } = await recordPolicyDecision({
      workspaceId: input.workspaceId,
      action: decisionActionFor(input.action),
      verdict: "deny",
      codes: [POLICY_CODES.CONTENT_GUARD_BLOCKED],
      amountUsd: valuation.amountUsd,
      networkId: input.networkId,
      tokenId: input.tokenId,
      agentId: input.agent._id,
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
      actor: input.actor,
      requestId: input.requestId,
      note: guard.violationTypes.join(",") || undefined,
    });

    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: input.agent.publicId,
      agentId: input.agent._id,
      action: "agent_policy_denied",
      resourceType: "compliance",
      resourceId: receiptId,
      security: input.security,
    });

    return {
      verdict: "deny",
      codes: [POLICY_CODES.CONTENT_GUARD_BLOCKED],
      policyVersion: null,
      policyId: null,
      receiptId,
      amountUsd: valuation.amountUsd,
      bypassed: false,
    };
  }

  const isCreateAction =
    input.action === "payment_links.create" ||
    input.action === "payment_links.batch_item";

  const [policyDoc, spend, outstandingFromDb] = await Promise.all([
    getAgentPolicy(input.workspaceId, input.agent._id),
    getAgentSpendTotals(input.workspaceId, input.agent._id),
    isCreateAction && input.outstandingUsd === undefined
      ? getAgentOutstandingLinkExposureUsd(input.workspaceId, input.agent._id)
      : Promise.resolve(0),
  ]);

  const outstandingUsd = isCreateAction
    ? (input.outstandingUsd ?? outstandingFromDb)
    : 0;

  const evaluated = evaluatePolicy({
    agentStatus: input.agent.status,
    action: input.action,
    amountUsd: valuation.amountUsd,
    networkId: input.networkId,
    tokenId: input.tokenId,
    policy: policyDoc ? toEvaluablePolicy(policyDoc) : null,
    spentDailyUsd: spend.spentDailyUsd,
    spentMonthlyUsd: spend.spentMonthlyUsd,
    outstandingUsd,
    approvalConsumed: input.approvalConsumed,
  });

  if (!isComplianceEnforcementEnabled()) {
    const { receiptId } = await recordPolicyDecision({
      workspaceId: input.workspaceId,
      action: decisionActionFor(input.action),
      verdict: evaluated.verdict === "deny" ? "allow" : evaluated.verdict,
      codes: [POLICY_CODES.ENFORCEMENT_BYPASSED, ...evaluated.codes],
      policyVersion: evaluated.policyVersion,
      policyId: evaluated.policyId,
      amountUsd: valuation.amountUsd,
      networkId: input.networkId,
      tokenId: input.tokenId,
      agentId: input.agent._id,
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
      actor: input.actor,
      requestId: input.requestId,
      note: "COMPLIANCE_ENFORCEMENT disabled",
    });

    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "system",
      actorId: "compliance",
      agentId: input.agent._id,
      action: "compliance_enforcement_bypassed",
      resourceType: "compliance",
      resourceId: receiptId,
      security: input.security,
    });

    return {
      ...evaluated,
      verdict: "allow",
      codes: [],
      receiptId,
      amountUsd: valuation.amountUsd,
      bypassed: true,
    };
  }

  const shouldSkipReceipt =
    input.skipReceiptOnAllow && evaluated.verdict === "allow";

  let receiptId: string | null = null;
  if (!shouldSkipReceipt) {
    const recorded = await recordPolicyDecision({
      workspaceId: input.workspaceId,
      action: decisionActionFor(input.action),
      verdict: evaluated.verdict,
      codes: evaluated.codes,
      policyVersion: evaluated.policyVersion,
      policyId: evaluated.policyId,
      amountUsd: valuation.amountUsd,
      networkId: input.networkId,
      tokenId: input.tokenId,
      agentId: input.agent._id,
      agentPublicId: input.agent.publicId,
      externalAgentId: input.agent.externalAgentId,
      actor: input.actor,
      requestId: input.requestId,
    });
    receiptId = recorded.receiptId;
  }

  if (evaluated.verdict === "deny") {
    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: input.agent.publicId,
      agentId: input.agent._id,
      action: "agent_policy_denied",
      resourceType: "compliance",
      resourceId: receiptId ?? undefined,
      security: input.security,
    });
    await logActivity({
      workspaceId: input.workspaceId,
      type: "blocked",
      status: "blocked",
      summary: `Agent ${input.agent.externalAgentId} blocked · ${evaluated.codes[0] ?? "POLICY_DENIED"}`,
    });
  } else if (evaluated.verdict === "require_approval") {
    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: input.agent.publicId,
      agentId: input.agent._id,
      action: "agent_policy_approval_required",
      resourceType: "compliance",
      resourceId: receiptId ?? undefined,
      security: input.security,
    });
  } else if (receiptId) {
    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "agent",
      actorId: input.agent.publicId,
      agentId: input.agent._id,
      action: "agent_policy_allowed",
      resourceType: "compliance",
      resourceId: receiptId,
      security: input.security,
    });
  }

  return {
    ...evaluated,
    receiptId,
    amountUsd: valuation.amountUsd,
    bypassed: false,
  };
}
