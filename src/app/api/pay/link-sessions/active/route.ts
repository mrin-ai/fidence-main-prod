import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentLinkSessionDoc } from "@/lib/pay/types";
import { getPaySessionContext } from "@/lib/pay/session-api";

export async function GET(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const db = await getDb();
  const sessions = await db
    .collection<AgentLinkSessionDoc>(COLLECTIONS.agentLinkSessions)
    .find({
      workspaceId: ctx.workspaceId,
      status: { $in: ["approved", "pending"] },
    })
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray();

  return NextResponse.json({
    ok: true,
    sessions: sessions.map((session) => ({
      linkId: session.linkId,
      agentName: session.agentName,
      platform: session.platform,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      approvedAt: session.approvedAt?.toISOString(),
    })),
  });
}
