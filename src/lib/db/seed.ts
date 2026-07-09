import { ObjectId } from "mongodb";
import { buildPaymentLinkUrl, generatePublicId } from "@/lib/payment-link-url";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { migrateWalletAddressesToVerifiedWallets } from "@/lib/db/wallets";
import type {
  PaymentLinkDoc,
  UserDoc,
} from "@/lib/db/types";

const MIGRATIONS_META_ID = "migrations_v1";

type DbMetaDoc = {
  _id: string;
  completedAt: Date;
};

export async function migrateLegacyPaymentLinks() {
  const db = await getDb();
  const legacyLinks = await db
    .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
    .find({
      $or: [
        { publicId: { $exists: false } },
        { username: { $exists: false } },
      ],
    })
    .toArray();

  for (const link of legacyLinks) {
    const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
      _id: link.createdBy,
    });

    const username =
      user?.username ?? `merchant-${link.createdBy.toString().slice(-6)}`;

    let publicId = generatePublicId();
    while (
      await db.collection(COLLECTIONS.paymentLinks).findOne({ publicId })
    ) {
      publicId = generatePublicId();
    }

    await db.collection(COLLECTIONS.paymentLinks).updateOne(
      { _id: link._id },
      {
        $set: {
          username,
          publicId,
          slug: publicId,
          url: buildPaymentLinkUrl(username, publicId),
          recipientAddress:
            link.recipientAddress ?? user?.walletAddresses[0]?.toLowerCase(),
          updatedAt: new Date(),
        },
      },
    );
  }
}

export async function purgeWorkspaceDemoData(workspaceId: ObjectId) {
  const db = await getDb();

  const demoActivitySummaries = [
    "Payment link created · 10 USDC",
    "Payment received · 25 USDC",
    "Invoice created · INV-2026-0042",
    "Payment link created · 50 USDC",
    "Payment received · 100 USDC",
  ];

  const [transactions, balances, activities] = await Promise.all([
    db.collection(COLLECTIONS.transactions).deleteMany({
      workspaceId,
      paymentLinkId: { $exists: false },
      txHash: { $exists: false },
    }),
    db.collection(COLLECTIONS.balances).deleteMany({ workspaceId }),
    db.collection(COLLECTIONS.activityEvents).deleteMany({
      workspaceId,
      summary: { $in: demoActivitySummaries },
    }),
  ]);

  return {
    removedTransactions: transactions.deletedCount,
    removedBalances: balances.deletedCount,
    removedActivities: activities.deletedCount,
  };
}

export async function migrateRemoveWorkspaceDemoData() {
  const db = await getDb();
  const workspaces = await db
    .collection(COLLECTIONS.workspaces)
    .find({ demoDataPurgedAt: { $exists: false } }, { projection: { _id: 1 } })
    .toArray();

  let removedTransactions = 0;
  let removedBalances = 0;
  let removedActivities = 0;

  for (const workspace of workspaces) {
    const result = await purgeWorkspaceDemoData(workspace._id);
    removedTransactions += result.removedTransactions;
    removedBalances += result.removedBalances;
    removedActivities += result.removedActivities;

    await db.collection(COLLECTIONS.workspaces).updateOne(
      { _id: workspace._id },
      { $set: { demoDataPurgedAt: new Date() } },
    );
  }

  return {
    workspaces: workspaces.length,
    removedTransactions,
    removedBalances,
    removedActivities,
  };
}

export async function runDbMigrations() {
  const db = await getDb();
  const existing = await db.collection<DbMetaDoc>(COLLECTIONS.dbMeta).findOne({
    _id: MIGRATIONS_META_ID,
  });

  if (existing) {
    return { skipped: true as const };
  }

  await migrateLegacyPaymentLinks();
  await migrateRemoveWorkspaceDemoData();
  await migrateWalletAddressesToVerifiedWallets();

  await db.collection<DbMetaDoc>(COLLECTIONS.dbMeta).insertOne({
    _id: MIGRATIONS_META_ID,
    completedAt: new Date(),
  });

  return { skipped: false as const };
}

export async function ensureDbIndexes() {
  const db = await getDb();

  await Promise.all([
    db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection(COLLECTIONS.users).createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection(COLLECTIONS.users).createIndex({ walletAddresses: 1 }),
    db.collection(COLLECTIONS.workspaces).createIndex({ slug: 1 }, { unique: true }),
    db.collection(COLLECTIONS.workspaceMembers).createIndex(
      { workspaceId: 1, userId: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.sessions).createIndex({ token: 1 }, { unique: true }),
    db.collection(COLLECTIONS.sessions).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(COLLECTIONS.paymentLinks).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.paymentLinks).createIndex(
      { workspaceId: 1, status: 1, createdAt: -1 },
    ),
    db.collection(COLLECTIONS.paymentLinks).createIndex(
      { publicId: 1 },
      { unique: true, sparse: true },
    ),
    db.collection(COLLECTIONS.paymentLinks).createIndex(
      { username: 1, publicId: 1 },
      { unique: true, sparse: true },
    ),
    db.collection(COLLECTIONS.transactions).createIndex({ workspaceId: 1, occurredAt: -1 }),
    db.collection(COLLECTIONS.transactions).createIndex(
      { txHash: 1 },
      { unique: true, sparse: true },
    ),
    db.collection(COLLECTIONS.activityEvents).createIndex({ workspaceId: 1, occurredAt: -1 }),
    db.collection(COLLECTIONS.activityEvents).createIndex({ occurredAt: 1 }),
    db.collection(COLLECTIONS.activityEventsArchive).createIndex({ workspaceId: 1, occurredAt: -1 }),
    db.collection(COLLECTIONS.activityEventsArchive).createIndex({ occurredAt: 1 }),
    db.collection(COLLECTIONS.invoices).createIndex({ workspaceId: 1, updatedAt: -1 }),
    db.collection(COLLECTIONS.invoices).createIndex({ workspaceId: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.invoices).createIndex(
      { workspaceId: 1, reference: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.balances).createIndex({ workspaceId: 1, tokenId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.workspaceDailyStats).createIndex(
      { workspaceId: 1, date: -1 },
      { unique: true },
    ),
  ]);
}

export async function bootstrapDatabase() {
  const migrationResult = await runDbMigrations();
  await ensureDbIndexes();
  return migrationResult;
}
