import { ObjectId } from "mongodb";

import { formatActivityMeta } from "@/lib/format-date";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import type {
  ActivityEventDoc,
  BalanceDoc,
  DashboardOverview,
  PaymentLinkDoc,
  TransactionDoc,
} from "@/lib/db/types";

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

  const [workspace, paymentLinks, transactions, activities, balances] =
    await Promise.all([
      db.collection(COLLECTIONS.workspaces).findOne({ _id: workspaceId }),
      db
        .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
        .find({ workspaceId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
      db
        .collection<TransactionDoc>(COLLECTIONS.transactions)
        .find({ workspaceId })
        .sort({ occurredAt: -1 })
        .limit(20)
        .toArray(),
      db
        .collection<ActivityEventDoc>(COLLECTIONS.activityEvents)
        .find({ workspaceId })
        .sort({ occurredAt: -1 })
        .limit(50)
        .toArray(),
      db
        .collection<BalanceDoc>(COLLECTIONS.balances)
        .find({ workspaceId })
        .sort({ label: 1 })
        .toArray(),
    ]);

  const totalLinks = paymentLinks.length;
  const completedLinks = paymentLinks.filter((link) => link.status === "paid").length;
  const pendingLinks = paymentLinks.filter((link) => link.status === "pending").length;
  const receivedAmount = transactions
    .filter((tx) => tx.type === "payment_received" && tx.status === "confirmed")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const rewardsAmount = 1.13;

  const linksByDay = groupCountByDay(
    paymentLinks.map((link) => link.createdAt),
  );
  const completedByDay = groupCountByDay(
    paymentLinks
      .filter((link) => link.status === "paid")
      .map((link) => link.paidAt ?? link.updatedAt),
  );
  const pendingByDay = groupCountByDay(
    paymentLinks
      .filter((link) => link.status === "pending")
      .map((link) => link.createdAt),
  );
  const receivedByDay = groupSumByDay(
    transactions
      .filter((tx) => tx.type === "payment_received")
      .map((tx) => ({ date: tx.occurredAt, value: tx.amount })),
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
        rewards: buildSparkline([0.42, 0.58, 0.71, 0.84, 0.96, 1.05, rewardsAmount]),
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
    activities: activities.map((event) => ({
      id: event._id.toString(),
      summary: event.summary,
      meta: formatActivityMeta(event.occurredAt),
      status: event.status,
      type: event.type,
    })),
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
      paymentLink: `pay.fidence.xyz/${workspace?.slug ?? "workspace"}`,
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
