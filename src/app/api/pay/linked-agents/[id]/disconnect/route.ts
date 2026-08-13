import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getLinkedAgentById } from "@/lib/db/agents";
import { disconnectLinkedAgent } from "@/lib/db/agent-links";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(_request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getLinkedAgentById(ctx.workspaceId, new ObjectId(id));
  if (!agent) {
    return NextResponse.json({ error: "Linked agent not found" }, { status: 404 });
  }

  const result = await disconnectLinkedAgent({
    workspaceId: ctx.workspaceId,
    agentObjectId: agent._id,
    userId: ctx.userId,
    security: ctx.security,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
