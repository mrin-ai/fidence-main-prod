import type { ObjectId } from "mongodb";

import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { calculatePaymentRewardCredits } from "@/lib/reward-config";

export type WorkspaceDailyStatField =
  | "linksCreated"
  | "linksPaid"
  | "linksPending"
  | "receivedAmount"
  | "sentAmount";

export type WorkspaceDailyStatsDoc = {
  _id?: ObjectId;
  workspaceId: ObjectId;
  date: string;
  linksCreated: number;
  linksPaid: number;
  linksPending: number;
  receivedAmount: number;
  sentAmount: number;
  updatedAt: Date;
};

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function lastNDayKeys(days: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - index);
    keys.push(utcDayKey(date));
  }
  return keys;
}

export async function incrementDailyStat(
  workspaceId: ObjectId,
  field: WorkspaceDailyStatField,
  amount = 1,
  date = new Date(),
) {
  const db = await getDb();
  const day = utcDayKey(date);

  await db.collection<WorkspaceDailyStatsDoc>(COLLECTIONS.workspaceDailyStats).updateOne(
    { workspaceId, date: day },
    {
      $inc: { [field]: amount },
      $setOnInsert: {
        workspaceId,
        date: day,
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

function buildCumulative(values: number[]) {
  let runningTotal = 0;
  return values.map((value) => {
    runningTotal += value;
    return runningTotal;
  });
}

export async function getSparklineStats(workspaceId: ObjectId, days = 7) {
  const db = await getDb();
  const keys = lastNDayKeys(days);
  const startDate = keys[0];

  const docs = await db
    .collection<WorkspaceDailyStatsDoc>(COLLECTIONS.workspaceDailyStats)
    .find({
      workspaceId,
      date: { $gte: startDate },
    })
    .toArray();

  const byDate = Object.fromEntries(
    docs.map((doc) => [doc.date, doc]),
  ) as Record<string, WorkspaceDailyStatsDoc>;

  const linksCreated = keys.map((key) => byDate[key]?.linksCreated ?? 0);
  const linksPaid = keys.map((key) => byDate[key]?.linksPaid ?? 0);
  const linksPending = keys.map((key) => byDate[key]?.linksPending ?? 0);
  const receivedAmount = keys.map((key) => byDate[key]?.receivedAmount ?? 0);
  const sentAmount = keys.map((key) => byDate[key]?.sentAmount ?? 0);

  return {
    links: buildCumulative(linksCreated),
    completed: buildCumulative(linksPaid),
    pending: buildCumulative(linksPending),
    received: buildCumulative(receivedAmount),
    rewards: buildCumulative(
      receivedAmount.map((amount, index) => {
        const rewardVolume = amount + (sentAmount[index] ?? 0);
        return calculatePaymentRewardCredits(rewardVolume);
      }),
    ),
  };
}
