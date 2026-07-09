import type { ObjectId } from "mongodb";

import { formatActivityMeta } from "@/lib/format-date";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ActivityEventDoc, ActivityStatus } from "@/lib/db/types";

export type ActivityListItem = {
  id: string;
  summary: string;
  meta: string;
  status?: ActivityStatus;
  type: string;
  occurredAt: string;
};

export const ACTIVITY_PAGE_LIMIT = 10;

function mapActivityDoc(event: ActivityEventDoc): ActivityListItem {
  return {
    id: event._id.toString(),
    summary: event.summary,
    meta: formatActivityMeta(event.occurredAt),
    status: event.status,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export async function listWorkspaceActivities(
  workspaceId: ObjectId,
  options: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(
    100,
    Math.max(1, options.limit ?? ACTIVITY_PAGE_LIMIT),
  );
  const skip = (page - 1) * limit;
  const db = await getDb();

  const [activities, total] = await Promise.all([
    db
      .collection<ActivityEventDoc>(COLLECTIONS.activityEvents)
      .find({ workspaceId })
      .sort({ occurredAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.activityEvents).countDocuments({ workspaceId }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items: activities.map(mapActivityDoc),
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}
