import { NextResponse } from "next/server";

import { listWorkspaceAgents } from "@/lib/db/agents";
import { getSessionFromCookies } from "@/lib/db/auth";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await listWorkspaceAgents(session.workspace._id);
  return NextResponse.json({ agents });
}
