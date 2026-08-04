/**
 * Compliance Engine policy types.
 *
 * Portal:
 * - GET  /api/merchant/compliance/agents
 * - GET  /api/merchant/compliance/agents/:id/policy
 * - PUT  /api/merchant/compliance/agents/:id/policy
 *
 * Merchant API:
 * - GET  /api/v1/compliance/catalog
 * - GET/PUT /api/v1/compliance/agents/:agentId/policy
 */

export type PolicyStatus = "none" | "draft" | "active";
export type ComplianceStatus = "blocked" | "compliant";

export type AgentPolicy = {
  agentId: string;
  status: "draft" | "active";
  maxAmountPerPayment: number;
  dailySpendCap: number;
  monthlySpendCap: number | null;
  allowedNetworkIds: string[];
  allowedTokenIds: string[];
  allowCreatePaymentLinks: boolean;
  allowPay: boolean;
  requireApprovalAbove: number | null;
  updatedAt: string;
  policyVersion?: number;
  externalAgentId?: string;
  publicId?: string;
};

export type AgentPolicyInput = Omit<AgentPolicy, "agentId" | "updatedAt">;

export const COMPLIANCE_NETWORKS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "sepolia", label: "Sepolia" },
  { id: "solana", label: "Solana" },
] as const;

export const COMPLIANCE_TOKENS = [
  { id: "usdc", label: "USDC" },
  { id: "usdt", label: "USDT" },
  { id: "eth", label: "ETH" },
  { id: "sol", label: "SOL" },
  { id: "lcx", label: "LCX" },
] as const;

export const WIDE_OPEN_DAILY_CAP = 10_000;
