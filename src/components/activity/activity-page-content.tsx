import Link from "next/link";

import {
  ActivityList,
  type ActivityItem,
} from "@/components/activity/activity-list";
import {
  ActivityPageSummary,
  ActivityPagination,
} from "@/components/activity/activity-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ActivityPageContent({
  feed,
}: {
  feed: {
    items: ActivityItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Activity</h2>
        <p className="text-sm text-muted-foreground">
          Full audit trail of logins, wallets, invoices, and payments.
        </p>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">All events</CardTitle>
          <ActivityPageSummary
            page={feed.page}
            limit={feed.limit}
            total={feed.total}
            totalPages={feed.totalPages}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <ActivityList activities={feed.items} />

          <ActivityPagination page={feed.page} totalPages={feed.totalPages} />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard" className="text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
