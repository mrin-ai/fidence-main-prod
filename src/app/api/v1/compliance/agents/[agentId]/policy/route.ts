import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import { parsePolicyBody } from "@/lib/compliance/policy-api";
import {
  getAgentPolicy,
  policyDocToApi,
  resolveWorkspaceAgent,
  upsertAgentPolicy,
} from "@/lib/db/agent-policies";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceCompliancePolicyRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ agentId: string }> };

function authMethodFromRequest(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  return ua.includes("payagent-compliance-cli") ? "cli" as const : "api_key" as const;
}

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const { agentId } = await params;
  const agent = await resolveWorkspaceAgent(context.workspace._id, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const policy = await getAgentPolicy(context.workspace._id, agent._id);
  return NextResponse.json({
    policy: policy ? policyDocToApi(policy) : null,
    agent: {
      publicId: agent.publicId,
      externalAgentId: agent.externalAgentId,
      status: agent.status,
    },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceCompliancePolicyRateLimit(
    getWorkspaceId(context),
  );
  if (rateLimited) return rateLimited;

  const { agentId } = await params;
  const agent = await resolveWorkspaceAgent(context.workspace._id, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parsePolicyBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await upsertAgentPolicy({
    workspaceId: context.workspace._id,
    agent,
    body: parsed.input,
    confirmWideOpen: parsed.confirmWideOpen,
    actor: actorFromSecurity(context.security, {
      actorType: "api_key",
      authMethod: authMethodFromRequest(request),
      userId: context.owner._id.toString(),
    }),
    security: context.security,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    policy: policyDocToApi(result.policy),
    receiptId: result.receiptId,
  });
}
