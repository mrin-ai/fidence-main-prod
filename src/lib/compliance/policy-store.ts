import type { AgentPolicy, AgentPolicyInput } from "@/lib/compliance/types";

const MIGRATION_BANNER_KEY = "payagent.compliance.server-sync-banner.v1";

export function shouldShowServerSyncBanner() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MIGRATION_BANNER_KEY) !== "dismissed";
  } catch {
    return true;
  }
}

export function dismissServerSyncBanner() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATION_BANNER_KEY, "dismissed");
  } catch {
    // ignore
  }
}

export async function listPolicies(): Promise<Record<string, AgentPolicy>> {
  const response = await fetch("/api/merchant/compliance/agents");
  if (!response.ok) {
    throw new Error("Failed to load compliance policies");
  }
  const data = (await response.json()) as {
    agents: Array<{ id: string; policy: AgentPolicy | null }>;
  };
  const map: Record<string, AgentPolicy> = {};
  for (const agent of data.agents) {
    if (agent.policy) map[agent.id] = agent.policy;
  }
  return map;
}

export async function getPolicy(agentId: string): Promise<AgentPolicy | null> {
  const response = await fetch(
    `/api/merchant/compliance/agents/${encodeURIComponent(agentId)}/policy`,
  );
  if (!response.ok) {
    throw new Error("Failed to load policy");
  }
  const data = (await response.json()) as { policy: AgentPolicy | null };
  return data.policy;
}

export async function savePolicy(
  agentId: string,
  input: AgentPolicyInput,
  options?: { confirmWideOpen?: boolean },
): Promise<AgentPolicy> {
  const response = await fetch(
    `/api/merchant/compliance/agents/${encodeURIComponent(agentId)}/policy`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        confirmWideOpen: options?.confirmWideOpen === true,
      }),
    },
  );
  const data = (await response.json()) as {
    policy?: AgentPolicy;
    error?: string;
    code?: string;
  };
  if (!response.ok || !data.policy) {
    throw new Error(data.error ?? "Failed to save policy");
  }
  return data.policy;
}

export async function fetchComplianceAudit(params?: {
  ip?: string;
  agentId?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.ip) search.set("ip", params.ip);
  if (params?.agentId) search.set("agentId", params.agentId);
  if (params?.limit) search.set("limit", String(params.limit));
  const response = await fetch(
    `/api/merchant/compliance/audit?${search.toString()}`,
  );
  if (!response.ok) throw new Error("Failed to load audit trail");
  return response.json() as Promise<{
    decisions: Array<{
      receiptId: string;
      action: string;
      verdict: string;
      codes: string[];
      actor: { actorType: string; ip: string; userId?: string | null };
      externalAgentId?: string | null;
      createdAt: string;
    }>;
  }>;
}

export async function fetchComplianceApprovals() {
  const response = await fetch("/api/merchant/compliance/approvals");
  if (!response.ok) throw new Error("Failed to load approvals");
  return response.json() as Promise<{
    approvals: Array<{
      approvalId: string;
      status: string;
      amountUsd: number;
      networkId: string;
      tokenId: string;
      externalAgentId: string;
      requestedBy: { ip: string };
      resolvedBy: { ip: string; userId?: string | null } | null;
      createdAt: string;
      expiresAt: string;
    }>;
  }>;
}

export async function resolveComplianceApproval(
  approvalId: string,
  decision: "approve" | "reject",
) {
  const response = await fetch(
    `/api/merchant/compliance/approvals/${encodeURIComponent(approvalId)}/${decision}`,
    { method: "POST" },
  );
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Failed to ${decision} approval`);
  }
  return data;
}
