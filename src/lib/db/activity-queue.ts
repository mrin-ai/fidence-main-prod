import { ObjectId } from "mongodb";

import { cacheDel, cacheLlen, cacheLpop, cacheRpush } from "@/lib/cache/redis";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ActivityLogInput } from "@/lib/db/activity-types";
import type { ActivityEventDoc } from "@/lib/db/types";

const ACTIVITY_QUEUE_KEY = "activity:queue";

type QueuedActivityPayload = {
  workspaceId: string;
  type: ActivityLogInput["type"];
  summary: string;
  status?: ActivityLogInput["status"];
  occurredAt?: string;
};

function serializeActivityInput(input: ActivityLogInput): string {
  const payload: QueuedActivityPayload = {
    workspaceId: input.workspaceId.toString(),
    type: input.type,
    summary: input.summary,
    status: input.status,
    occurredAt: input.occurredAt?.toISOString(),
  };
  return JSON.stringify(payload);
}

function parseQueuedActivity(raw: unknown): ActivityLogInput | null {
  try {
    const payload = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as QueuedActivityPayload;
    if (!payload.workspaceId || !payload.type || !payload.summary) {
      return null;
    }

    return {
      workspaceId: new ObjectId(payload.workspaceId),
      type: payload.type,
      summary: payload.summary,
      status: payload.status,
      occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
    };
  } catch {
    return null;
  }
}

export async function enqueueActivity(input: ActivityLogInput) {
  await cacheRpush(ACTIVITY_QUEUE_KEY, serializeActivityInput(input));
}

export async function drainActivityQueue(batchSize = 50) {
  const queueLength = await cacheLlen(ACTIVITY_QUEUE_KEY);
  if (queueLength === 0) {
    return { drained: 0 };
  }

  const payloads: ActivityLogInput[] = [];

  for (let index = 0; index < batchSize; index += 1) {
    const raw = await cacheLpop(ACTIVITY_QUEUE_KEY);
    if (!raw) break;
    const parsed = parseQueuedActivity(raw);
    if (parsed) {
      payloads.push(parsed);
    }
  }

  if (payloads.length === 0) {
    return { drained: 0 };
  }

  const db = await getDb();
  const now = new Date();
  const workspaceIds = new Set<string>();

  const docs = payloads.map((input) => {
    workspaceIds.add(input.workspaceId.toString());
    const occurredAt = input.occurredAt ?? now;
    return {
      workspaceId: input.workspaceId,
      type: input.type,
      summary: input.summary,
      meta: "",
      status: input.status,
      occurredAt,
      createdAt: now,
    } satisfies Omit<ActivityEventDoc, "_id">;
  });

  await db.collection(COLLECTIONS.activityEvents).insertMany(docs);

  await Promise.all(
    [...workspaceIds].map((workspaceId) =>
      cacheDel(`activity:count:${workspaceId}`),
    ),
  );

  return { drained: docs.length };
}

export async function writeActivityDirect(input: ActivityLogInput) {
  const db = await getDb();
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  await db.collection(COLLECTIONS.activityEvents).insertOne({
    workspaceId: input.workspaceId as ObjectId,
    type: input.type,
    summary: input.summary,
    meta: "",
    status: input.status,
    occurredAt,
    createdAt: now,
  });

  await cacheDel(`activity:count:${input.workspaceId.toString()}`);
}
