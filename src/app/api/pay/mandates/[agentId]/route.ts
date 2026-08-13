import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getAgentPolicy, policyDocToApi, upsertAgentPolicy } from "@/lib/db/agent-policies";
import { getLinkedAgentById } from "@/lib/db/agents";
import type { AgentPolicyInput } from "@/lib/compliance/types";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(_request);
  if (!ctx.ok) return ctx.response;

  const { agentId } = await params;
  if (!ObjectId.isValid(agentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getLinkedAgentById(ctx.workspaceId, new ObjectId(agentId));
  if (!agent) {
    return NextResponse.json({ error: "Linked agent not found" }, { status: 404 });
  }

  const policy = await getAgentPolicy(ctx.workspaceId, agent._id);
  if (!policy) {
    return NextResponse.json({ ok: true, policy: null });
  }

  return NextResponse.json({ ok: true, policy: policyDocToApi(policy) });
}

export async function PUT(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { agentId } = await params;
  if (!ObjectId.isValid(agentId)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getLinkedAgentById(ctx.workspaceId, new ObjectId(agentId));
  if (!agent) {
    return NextResponse.json({ error: "Linked agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as AgentPolicyInput & { confirmWideOpen?: boolean };
  const result = await upsertAgentPolicy({
    workspaceId: ctx.workspaceId,
    agent,
    body,
    security: ctx.security,
    actor: {
      actorType: "user",
      authMethod: "session",
      userId: ctx.userId.toString(),
      ip: ctx.security.ip,
      userAgent: ctx.security.userAgent,
      country: ctx.security.country,
      device: ctx.security.device,
      browser: ctx.security.browser,
    },
    confirmWideOpen: body.confirmWideOpen,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    policy: policyDocToApi(result.policy),
    receiptId: result.receiptId,
  });
}
