import type { AgentListItem } from "@/lib/merchant-ui-types";
import {
  COMPLIANCE_NETWORKS,
  COMPLIANCE_TOKENS,
  type AgentPolicy,
  type ComplianceStatus,
  type PolicyStatus,
} from "@/lib/compliance/types";

export function getPolicyStatus(policy: AgentPolicy | null): PolicyStatus {
  if (!policy) return "none";
  return policy.status;
}

export function getComplianceStatus(
  agent: Pick<AgentListItem, "status">,
  policy: AgentPolicy | null,
): ComplianceStatus {
  if (agent.status === "active" && policy?.status === "active") {
    return "compliant";
  }
  return "blocked";
}

export function formatLimitsSummary(policy: AgentPolicy | null): string {
  if (!policy) return "—";

  const networks = policy.allowedNetworkIds
    .map((id) => COMPLIANCE_NETWORKS.find((n) => n.id === id)?.label ?? id)
    .join(", ");
  const tokens = policy.allowedTokenIds
    .map((id) => COMPLIANCE_TOKENS.find((t) => t.id === id)?.label ?? id.toUpperCase())
    .join(", ");

  const parts = [`≤ $${formatUsd(policy.maxAmountPerPayment)}`];
  if (networks) parts.push(networks);
  if (tokens) parts.push(tokens);
  return parts.join(" · ");
}

function formatUsd(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function createEmptyPolicyInput(): Omit<
  AgentPolicy,
  "agentId" | "updatedAt"
> {
  return {
    status: "draft",
    maxAmountPerPayment: 50,
    dailySpendCap: 200,
    monthlySpendCap: null,
    allowedNetworkIds: ["ethereum", "base", "sepolia", "solana"],
    allowedTokenIds: ["usdc", "usdt"],
    allowCreatePaymentLinks: true,
    allowPay: true,
    requireApprovalAbove: null,
  };
}
