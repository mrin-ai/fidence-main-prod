import { NextResponse } from "next/server";

import { serializeDecision } from "@/lib/compliance/policy-api";
import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listAgentPolicyDecisions } from "@/lib/db/policy-decisions";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const agent = await resolveWorkspaceAgent(session.workspace._id, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const decisions = await listAgentPolicyDecisions({
    workspaceId: session.workspace._id,
    agentId: agent._id,
    limit,
  });

  return NextResponse.json({
    decisions: decisions.map(serializeDecision),
  });
}
