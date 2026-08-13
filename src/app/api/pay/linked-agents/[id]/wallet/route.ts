import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { addAgentWallet } from "@/lib/db/agents";
import { getLinkedAgentById } from "@/lib/db/agents";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
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

  const body = (await request.json()) as {
    walletAddress?: string;
    networkId?: string;
  };

  if (!body.walletAddress || !body.networkId) {
    return NextResponse.json(
      { error: "walletAddress and networkId are required" },
      { status: 400 },
    );
  }

  const result = await addAgentWallet({
    workspaceId: ctx.workspaceId,
    externalAgentId: agent.externalAgentId,
    walletAddress: body.walletAddress,
    networkId: body.networkId,
    security: ctx.security,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, created: result.created });
}
