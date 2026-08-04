import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import { parsePolicyBody } from "@/lib/compliance/policy-api";
import {
  getAgentPolicy,
  policyDocToApi,
  resolveWorkspaceAgent,
  upsertAgentPolicy,
} from "@/lib/db/agent-policies";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  canMutateCompliance,
  getWorkspaceMembership,
} from "@/lib/db/workspace-membership";
import { enforceCompliancePolicyRateLimit } from "@/lib/merchant-api/rate-limit";
import { extractSecurityContext } from "@/lib/request-security";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const agent = await resolveWorkspaceAgent(session.workspace._id, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const policy = await getAgentPolicy(session.workspace._id, agent._id);
  return NextResponse.json({
    policy: policy ? policyDocToApi(policy) : null,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getWorkspaceMembership(
    session.workspace._id,
    session.user._id,
  );
  if (!canMutateCompliance(membership?.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can update policies" },
      { status: 403 },
    );
  }

  const rateLimited = await enforceCompliancePolicyRateLimit(session.workspace._id);
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const agent = await resolveWorkspaceAgent(session.workspace._id, id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const security = extractSecurityContext(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parsePolicyBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await upsertAgentPolicy({
    workspaceId: session.workspace._id,
    agent,
    body: parsed.input,
    confirmWideOpen: parsed.confirmWideOpen,
    actor: actorFromSecurity(security, {
      actorType: "user",
      authMethod: "session",
      userId: session.user._id.toString(),
    }),
    security,
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
