import { NextResponse } from "next/server";

import {
  approveAgentLinkSession,
  getAgentLinkSession,
  rejectAgentLinkSession,
} from "@/lib/db/agent-links";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ lid: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(_request);
  if (!ctx.ok) return ctx.response;

  const { lid } = await params;
  const session = await getAgentLinkSession(lid);
  if (!session) {
    return NextResponse.json({ error: "Link session not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    session: {
      linkId: session.linkId,
      agentName: session.agentName,
      platform: session.platform,
      description: session.description,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { lid } = await params;
  const body = (await request.json()) as { action?: "approve" | "reject" };

  if (body.action === "reject") {
    const result = await rejectAgentLinkSession({
      linkId: lid,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      security: ctx.security,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const result = await approveAgentLinkSession({
    linkId: lid,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    security: ctx.security,
  });

  if (!result.ok) {
    const status = result.code === "LINKED_AGENT_LIMIT" ? 409 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    status: "approved",
    agent: {
      id: result.agent._id.toString(),
      publicId: result.agent.publicId,
      externalAgentId: result.agent.externalAgentId,
      name: result.agent.name,
    },
  });
}
