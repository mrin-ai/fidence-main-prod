import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getLinkedAgentById, setAgentStatus } from "@/lib/db/agents";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getLinkedAgentById(ctx.workspaceId, new ObjectId(id));
  if (!agent) {
    return NextResponse.json({ error: "Linked agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as { status?: "active" | "inactive" };
  if (body.status !== "active" && body.status !== "inactive") {
    return NextResponse.json({ error: "status must be active or inactive" }, { status: 400 });
  }

  const result = await setAgentStatus({
    workspaceId: ctx.workspaceId,
    agentId: agent._id,
    status: body.status,
    security: ctx.security,
    actorUserId: ctx.userId.toString(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: result.agent.status });
}
