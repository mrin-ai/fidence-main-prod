import { NextResponse } from "next/server";

import { serializeDecision } from "@/lib/compliance/policy-api";
import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { listAgentPolicyDecisions } from "@/lib/db/policy-decisions";
import { enforceComplianceReadRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceComplianceReadRateLimit(
    getWorkspaceId(context),
  );
  if (rateLimited) return rateLimited;

  const { agentId } = await params;
  const agent = await resolveWorkspaceAgent(context.workspace._id, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const decisions = await listAgentPolicyDecisions({
    workspaceId: context.workspace._id,
    agentId: agent._id,
    limit,
  });

  return NextResponse.json({
    decisions: decisions.map(serializeDecision),
  });
}
