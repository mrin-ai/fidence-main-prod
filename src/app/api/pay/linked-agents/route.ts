import { NextResponse } from "next/server";

import { listLinkedAgents } from "@/lib/db/agents";
import { getPaySessionContext } from "@/lib/pay/session-api";

export async function GET(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const agents = await listLinkedAgents(ctx.workspaceId);
  return NextResponse.json({ ok: true, agents });
}
