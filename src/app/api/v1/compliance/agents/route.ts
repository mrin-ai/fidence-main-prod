import { NextResponse } from "next/server";

import {
  getComplianceStatus,
  getPolicyStatus,
} from "@/lib/compliance/policy-helpers";
import { listWorkspaceAgents } from "@/lib/db/agents";
import { listAgentPolicies, policyDocToApi } from "@/lib/db/agent-policies";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const [agents, policies] = await Promise.all([
    listWorkspaceAgents(context.workspace._id),
    listAgentPolicies(context.workspace._id),
  ]);

  const policyByAgentId = new Map(
    policies.map((policy) => [policy.agentId.toString(), policyDocToApi(policy)]),
  );

  return NextResponse.json({
    agents: agents.map((agent) => {
      const policy = policyByAgentId.get(agent.id) ?? null;
      return {
        publicId: agent.publicId,
        externalAgentId: agent.externalAgentId,
        name: agent.name,
        status: agent.status,
        policyStatus: getPolicyStatus(policy),
        complianceStatus: getComplianceStatus(agent, policy),
        policy,
      };
    }),
  });
}
