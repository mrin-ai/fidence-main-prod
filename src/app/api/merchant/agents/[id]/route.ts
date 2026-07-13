import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { setAgentStatus } from "@/lib/db/agents";
import { getSessionFromCookies } from "@/lib/db/auth";
import { extractSecurityContext } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const body = (await request.json()) as {
    status?: "active" | "inactive";
  };

  if (body.status !== "active" && body.status !== "inactive") {
    return NextResponse.json(
      { error: "status must be 'active' or 'inactive'" },
      { status: 400 },
    );
  }

  const result = await setAgentStatus({
    workspaceId: session.workspace._id,
    agentId: new ObjectId(id),
    status: body.status,
    security: extractSecurityContext(request),
    actorUserId: session.user._id.toString(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    agent: {
      id: result.agent._id.toString(),
      publicId: result.agent.publicId,
      externalAgentId: result.agent.externalAgentId,
      status: result.agent.status,
    },
  });
}
