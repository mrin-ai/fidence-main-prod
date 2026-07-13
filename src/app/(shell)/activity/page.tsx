import { redirect } from "next/navigation";

import { ActivityPageContent } from "@/components/activity/activity-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  ACTIVITY_PAGE_LIMIT,
  listWorkspaceActivities,
} from "@/lib/db/activity-feed";
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/activity");
  }

  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam ?? "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.floor(requestedPage)
    : 1;

  const feed = await listWorkspaceActivities(session.workspace._id, {
    page,
    limit: ACTIVITY_PAGE_LIMIT,
  });

  if (page > feed.totalPages) {
    const redirectUrl =
      feed.totalPages <= 1 ? "/activity" : `/activity?page=${feed.totalPages}`;
    redirect(redirectUrl);
  }

  return <ActivityPageContent feed={feed} />;
}
