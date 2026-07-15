import { NextResponse } from "next/server";

import { getAgentLeaderboard } from "@/lib/db/agent-leaderboard";

export async function GET() {
  const leaderboard = await getAgentLeaderboard();

  return NextResponse.json(leaderboard, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
