import { NextResponse } from "next/server";

import { listWorkspaceAgents } from "@/lib/db/agents";
import { listAgentPolicies, policyDocToApi } from "@/lib/db/agent-policies";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  getComplianceStatus,
  getPolicyStatus,
} from "@/lib/compliance/policy-helpers";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [agents, policies] = await Promise.all([
    listWorkspaceAgents(session.workspace._id),
    listAgentPolicies(session.workspace._id),
  ]);

  const policyByAgentId = new Map(
    policies.map((policy) => [policy.agentId.toString(), policyDocToApi(policy)]),
  );

  return NextResponse.json({
    agents: agents.map((agent) => {
      const policy = policyByAgentId.get(agent.id) ?? null;
      return {
        ...agent,
        policy,
        policyStatus: getPolicyStatus(policy),
        complianceStatus: getComplianceStatus(agent, policy),
      };
    }),
  });
}
