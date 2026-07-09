import { ObjectId } from "mongodb";

import { listWorkspaceActivities } from "@/lib/db/activity-feed";
import { buildProfileUrl } from "@/lib/profile-url";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import type {
  BalanceDoc,
  DashboardOverview,
  PaymentLinkDoc,
  TransactionDoc,
  UserDoc,
} from "@/lib/db/types";

/** Creator rewards accrue at 0.6% of confirmed payments received. */
const CREATOR_REWARD_RATE = 0.006;

const standaloneLinkFilter = (workspaceId: ObjectId) => ({
  workspaceId,
  invoiceId: { $exists: false },
});

function formatUsd(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTokenAmount(amount: number, symbol: string) {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${symbol.toUpperCase()}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildSparkline(values: number[]) {
  if (values.length >= 7) return values.slice(-7);
  if (values.length === 0) return [0, 0, 0, 0, 0, 0, 0];

  const padded = [...values];
  while (padded.length < 7) {
    padded.unshift(padded[0] ?? 0);
  }
  return padded.slice(-7);
}

export async function getDashboardOverview(
  workspaceId: ObjectId,
): Promise<DashboardOverview> {
  const db = await getDb();
  const linkFilter = standaloneLinkFilter(workspaceId);

  const [
    workspace,
    workspaceOwner,
    totalLinks,
    completedLinks,
    pendingLinks,
    paymentLinks,
    linkSparklineSource,
    paymentTransactions,
    transactions,
    activityFeed,
    balances,
  ] = await Promise.all([
    db.collection(COLLECTIONS.workspaces).findOne({ _id: workspaceId }),
    db.collection(COLLECTIONS.workspaces).findOne({ _id: workspaceId }).then(async (ws) => {
      if (!ws) return null;
      return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: ws.ownerId });
    }),
    db.collection(COLLECTIONS.paymentLinks).countDocuments(linkFilter),
    db
      .collection(COLLECTIONS.paymentLinks)
      .countDocuments({ ...linkFilter, status: "paid" }),
    db
      .collection(COLLECTIONS.paymentLinks)
      .countDocuments({ ...linkFilter, status: "pending" }),
    db
      .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
      .find(linkFilter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
    db
      .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
      .find(linkFilter, {
        projection: { createdAt: 1, status: 1, paidAt: 1, updatedAt: 1 },
      })
      .toArray(),
    db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find(
        {
          workspaceId,
          type: { $in: ["payment_received", "profile_payment"] },
          status: "confirmed",
        },
        { projection: { amount: 1, occurredAt: 1 } },
      )
      .toArray(),
    db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find({ workspaceId })
      .sort({ occurredAt: -1 })
      .limit(20)
      .toArray(),
    listWorkspaceActivities(workspaceId, { page: 1, limit: 100 }),
    db
      .collection<BalanceDoc>(COLLECTIONS.balances)
      .find({ workspaceId })
      .sort({ label: 1 })
      .toArray(),
  ]);

  const receivedAmount = paymentTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const rewardsAmount = receivedAmount * CREATOR_REWARD_RATE;

  const linksByDay = groupCountByDay(
    linkSparklineSource.map((link) => link.createdAt),
  );
  const completedByDay = groupCountByDay(
    linkSparklineSource
      .filter((link) => link.status === "paid")
      .map((link) => link.paidAt ?? link.updatedAt),
  );
  const pendingByDay = groupCountByDay(
    linkSparklineSource
      .filter((link) => link.status === "pending")
      .map((link) => link.createdAt),
  );
  const receivedByDay = groupSumByDay(
    paymentTransactions.map((transaction) => ({
      date: transaction.occurredAt,
      value: transaction.amount,
    })),
  );
  const rewardsByDay = receivedByDay.map(
    (amount) => Math.round(amount * CREATOR_REWARD_RATE * 100) / 100,
  );

  return {
    metrics: {
      totalLinks,
      completedLinks,
      pendingLinks,
      receivedAmount,
      rewardsAmount,
      sparklines: {
        links: buildSparkline(linksByDay),
        completed: buildSparkline(completedByDay),
        pending: buildSparkline(pendingByDay),
        received: buildSparkline(receivedByDay),
        rewards: buildSparkline(rewardsByDay),
      },
    },
    paymentLinks: paymentLinks.map((link) => ({
      id: link._id.toString(),
      amount: formatTokenAmount(link.amount, link.tokenId),
      status: link.status,
      url: link.url,
      publicId: link.publicId,
    })),
    transactions: transactions.map((tx) => ({
      id: tx._id.toString(),
      label: tx.label,
      date: formatDate(tx.occurredAt),
      amount: `+${formatTokenAmount(tx.amount, tx.symbol)}`,
    })),
    activities: activityFeed.items,
    balances: balances.map((balance) => ({
      id: balance.tokenId,
      label: balance.label,
      value: balance.amount.toLocaleString("en-US", {
        minimumFractionDigits: balance.tokenId === "usdc" ? 2 : 1,
        maximumFractionDigits: 2,
      }),
    })),
    workspace: {
      name: workspace?.name ?? "Workspace",
      slug: workspace?.slug ?? "workspace",
      paymentLink: workspaceOwner?.username
        ? buildProfileUrl(workspaceOwner.username)
        : "",
    },
    user: {
      name: "",
      role: "",
      initials: "",
    },
  };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastSevenDayKeys() {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    keys.push(dayKey(date));
  }
  return keys;
}

function groupCountByDay(dates: Date[]) {
  const keys = lastSevenDayKeys();
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));

  for (const date of dates) {
    const key = dayKey(date);
    if (key in counts) counts[key] += 1;
  }

  let runningTotal = 0;
  return keys.map((key) => {
    runningTotal += counts[key];
    return runningTotal;
  });
}

function groupSumByDay(entries: Array<{ date: Date; value: number }>) {
  const keys = lastSevenDayKeys();
  const sums = Object.fromEntries(keys.map((key) => [key, 0]));

  for (const entry of entries) {
    const key = dayKey(entry.date);
    if (key in sums) sums[key] += entry.value;
  }

  let runningTotal = 0;
  return keys.map((key) => {
    runningTotal += sums[key];
    return runningTotal;
  });
}

export { formatUsd, formatTokenAmount };
