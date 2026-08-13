import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getLinkedAgentById, setLinkedAgentDefaultWallet } from "@/lib/db/agents";
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

  const body = (await request.json()) as { walletId?: string };
  if (!body.walletId) {
    return NextResponse.json({ error: "walletId is required" }, { status: 400 });
  }

  const result = await setLinkedAgentDefaultWallet({
    workspaceId: ctx.workspaceId,
    agentObjectId: agent._id,
    walletId: body.walletId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
