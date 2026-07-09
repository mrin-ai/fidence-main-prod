import { NextResponse } from "next/server";

import { listWorkspaceActivities, ACTIVITY_PAGE_LIMIT } from "@/lib/db/activity-feed";
import { getSessionFromCookies } from "@/lib/db/auth";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? String(ACTIVITY_PAGE_LIMIT));

  const result = await listWorkspaceActivities(session.workspace._id, {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : ACTIVITY_PAGE_LIMIT,
  });

  return NextResponse.json(result);
}
