import { NextResponse } from "next/server";

import { registerAgent } from "@/lib/db/agents";
import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const body = (await request.json()) as {
    agentId?: string;
    agentName?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const name = body.agentName?.trim();

  if (!externalAgentId || !name) {
    return NextResponse.json(
      { error: "agentId and agentName are required" },
      { status: 400 },
    );
  }

  const result = await registerAgent({
    workspaceId: context.workspace._id,
    externalAgentId,
    name,
    security: context.security,
  });

  if (!result.ok) {
    const status =
      result.code === "AGENT_LIMIT_REACHED"
        ? 403
        : result.code === "AGENT_EXISTS"
          ? 409
          : 400;

    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...(result.agent
          ? {
              agent: {
                publicId: result.agent.publicId,
                externalAgentId: result.agent.externalAgentId,
              },
            }
          : {}),
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    agent: {
      publicId: result.agent.publicId,
      externalAgentId: result.agent.externalAgentId,
      name: result.agent.name,
      status: result.agent.status,
      created: result.created,
    },
  });
}
