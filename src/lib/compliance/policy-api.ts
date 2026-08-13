import type { AgentPolicyInput } from "@/lib/compliance/types";

export function parsePolicyBody(body: Record<string, unknown>): {
  input: AgentPolicyInput;
  confirmWideOpen?: boolean;
} | { error: string } {
  const status = body.status === "active" ? "active" : "draft";
  const maxAmountPerPayment = Number(body.maxAmountPerPayment);
  const dailySpendCap = Number(body.dailySpendCap);
  const monthlySpendCap =
    body.monthlySpendCap === null || body.monthlySpendCap === undefined
      ? null
      : Number(body.monthlySpendCap);
  const requireApprovalAbove =
    body.requireApprovalAbove === null || body.requireApprovalAbove === undefined
      ? null
      : Number(body.requireApprovalAbove);

  const allowedNetworkIds = Array.isArray(body.allowedNetworkIds)
    ? body.allowedNetworkIds.map(String)
    : null;
  const allowedTokenIds = Array.isArray(body.allowedTokenIds)
    ? body.allowedTokenIds.map(String)
    : null;

  if (!allowedNetworkIds || !allowedTokenIds) {
    return { error: "allowedNetworkIds and allowedTokenIds are required" };
  }

  return {
    input: {
      status,
      maxAmountPerPayment,
      dailySpendCap,
      monthlySpendCap,
      allowedNetworkIds,
      allowedTokenIds,
      allowCreatePaymentLinks: Boolean(body.allowCreatePaymentLinks),
      allowPay: Boolean(body.allowPay),
      autoPayEnabled: body.autoPayEnabled === true,
      requireApprovalAbove,
    },
    confirmWideOpen: body.confirmWideOpen === true,
  };
}

export function serializeDecision(doc: {
  receiptId: string;
  action: string;
  verdict: string;
  codes: string[];
  policyVersion: number | null;
  amountUsd?: number;
  networkId?: string;
  tokenId?: string;
  agentPublicId?: string;
  externalAgentId?: string;
  actor: {
    actorType: string;
    authMethod?: string;
    userId?: string;
    agentId?: string;
    agentPublicId?: string;
    externalAgentId?: string;
    ip: string;
    userAgent?: string;
    country?: string;
  };
  createdAt: Date;
  note?: string;
}) {
  return {
    receiptId: doc.receiptId,
    action: doc.action,
    verdict: doc.verdict,
    codes: doc.codes,
    policyVersion: doc.policyVersion,
    amountUsd: doc.amountUsd ?? null,
    networkId: doc.networkId ?? null,
    tokenId: doc.tokenId ?? null,
    agentPublicId: doc.agentPublicId ?? null,
    externalAgentId: doc.externalAgentId ?? null,
    actor: {
      actorType: doc.actor.actorType,
      authMethod: doc.actor.authMethod ?? null,
      userId: doc.actor.userId ?? null,
      agentId: doc.actor.agentId ?? null,
      agentPublicId: doc.actor.agentPublicId ?? null,
      externalAgentId: doc.actor.externalAgentId ?? null,
      ip: doc.actor.ip,
      userAgent: doc.actor.userAgent ?? null,
      country: doc.actor.country ?? null,
    },
    createdAt: doc.createdAt.toISOString(),
    note: doc.note ?? null,
  };
}
