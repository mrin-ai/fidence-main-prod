import { NextResponse } from "next/server";

import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import { setAgentStatus } from "@/lib/db/agents";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ agentId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { agentId } = await params;
  const agent = await resolveWorkspaceAgent(context.workspace._id, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as { status?: "active" | "inactive" };
  if (body.status !== "active" && body.status !== "inactive") {
    return NextResponse.json(
      { error: "status must be 'active' or 'inactive'" },
      { status: 400 },
    );
  }

  const result = await setAgentStatus({
    workspaceId: context.workspace._id,
    agentId: agent._id,
    status: body.status,
    security: context.security,
    actorUserId: context.owner._id.toString(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    agent: {
      publicId: result.agent.publicId,
      externalAgentId: result.agent.externalAgentId,
      status: result.agent.status,
    },
  });
}
