import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { serializeDecision } from "@/lib/compliance/policy-api";
import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { queryPolicyDecisions } from "@/lib/db/policy-decisions";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

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
    workspaceId: context.workspace._id,
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
