import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ObjectId } from "mongodb";

import { getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";
import type { PaymentLinkDoc, TransactionDoc } from "../src/lib/db/types";
import { incrementDailyStat } from "../src/lib/db/workspace-stats";

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing env file.
  }
}

function utcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWithinLastSevenDays(date: Date) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  cutoff.setUTCHours(0, 0, 0, 0);
  return date >= cutoff;
}

async function main() {
  loadEnvFile();
  const db = await getDb();

  const workspaces = await db
    .collection(COLLECTIONS.workspaces)
    .find({}, { projection: { _id: 1 } })
    .toArray();

  for (const workspace of workspaces) {
    await db.collection(COLLECTIONS.workspaceDailyStats).deleteMany({
      workspaceId: workspace._id,
    });

    const links = await db
      .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
      .find({
        workspaceId: workspace._id,
        invoiceId: { $exists: false },
      })
      .toArray();

    for (const link of links) {
      if (!isWithinLastSevenDays(link.createdAt)) continue;

      await incrementDailyStat(workspace._id, "linksCreated", 1, link.createdAt);
      if (link.status === "pending") {
        await incrementDailyStat(workspace._id, "linksPending", 1, link.createdAt);
      }
      if (link.status === "paid") {
        const paidDate = link.paidAt ?? link.updatedAt;
        if (isWithinLastSevenDays(paidDate)) {
          await incrementDailyStat(workspace._id, "linksPaid", 1, paidDate);
        }
      }
    }

    const transactions = await db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find({
        workspaceId: workspace._id,
        type: { $in: ["payment_received", "profile_payment"] },
        status: "confirmed",
      })
      .toArray();

    for (const transaction of transactions) {
      if (!isWithinLastSevenDays(transaction.occurredAt)) continue;
      await incrementDailyStat(
        workspace._id,
        "receivedAmount",
        transaction.amount,
        transaction.occurredAt,
      );
    }

    console.log(`Backfilled workspace ${workspace._id.toString()}`);
  }

  console.log(`Backfill complete for ${workspaces.length} workspaces.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
