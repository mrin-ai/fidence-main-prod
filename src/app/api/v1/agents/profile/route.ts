import { NextResponse } from "next/server";

import { getAgentProfile } from "@/lib/db/agents";
import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const { searchParams } = new URL(request.url);
  const externalAgentId = searchParams.get("agentId")?.trim();

  if (!externalAgentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const profile = await getAgentProfile(context.workspace._id, externalAgentId);

  if (!profile) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
