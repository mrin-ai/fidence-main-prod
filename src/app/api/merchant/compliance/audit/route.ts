import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { serializeDecision } from "@/lib/compliance/policy-api";
import { getSessionFromCookies } from "@/lib/db/auth";
import { queryPolicyDecisions } from "@/lib/db/policy-decisions";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const ip = url.searchParams.get("ip")?.trim() || undefined;
  const actorType = url.searchParams.get("actorType")?.trim() || undefined;
  const agentIdRaw = url.searchParams.get("agentId")?.trim();
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const agentId =
    agentIdRaw && ObjectId.isValid(agentIdRaw)
      ? new ObjectId(agentIdRaw)
      : undefined;

  const decisions = await queryPolicyDecisions({
    workspaceId: session.workspace._id,
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
    ip,
    actorType,
    agentId,
    limit,
  });

  return NextResponse.json({
    decisions: decisions.map(serializeDecision),
  });
}
