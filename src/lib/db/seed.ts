import { ObjectId } from "mongodb";
import { buildPaymentLinkUrl, generatePublicId } from "@/lib/payment-link-url";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type {
  ActivityEventDoc,
  BalanceDoc,
  PaymentLinkDoc,
  TransactionDoc,
  UserDoc,
} from "@/lib/db/types";

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

export async function ensureDbIndexes() {
  const db = await getDb();

  await migrateLegacyPaymentLinks();

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
      { publicId: 1 },
      { unique: true, sparse: true },
    ),
    db.collection(COLLECTIONS.paymentLinks).createIndex(
      { username: 1, publicId: 1 },
      { unique: true, sparse: true },
    ),
    db.collection(COLLECTIONS.transactions).createIndex({ workspaceId: 1, occurredAt: -1 }),
    db.collection(COLLECTIONS.activityEvents).createIndex({ workspaceId: 1, occurredAt: -1 }),
    db.collection(COLLECTIONS.invoices).createIndex({ workspaceId: 1, updatedAt: -1 }),
    db.collection(COLLECTIONS.invoices).createIndex(
      { workspaceId: 1, reference: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.balances).createIndex({ workspaceId: 1, tokenId: 1 }, { unique: true }),
  ]);
}

export async function seedWorkspaceDemoData(workspaceId: ObjectId, userId: ObjectId) {
  const db = await getDb();
  const existingLinks = await db
    .collection(COLLECTIONS.paymentLinks)
    .countDocuments({ workspaceId });

  if (existingLinks > 0) return { seeded: false };

  const now = new Date();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: userId });
  const username = user?.username ?? `merchant-${userId.toString().slice(-6)}`;
  const recipientAddress = user?.walletAddresses[0]?.toLowerCase();

  function buildSeedLink(
    link: Omit<
      PaymentLinkDoc,
      "_id" | "username" | "publicId" | "slug" | "url" | "recipientAddress"
    >,
  ): Omit<PaymentLinkDoc, "_id"> {
    const publicId = generatePublicId();
    return {
      ...link,
      username,
      publicId,
      slug: publicId,
      url: buildPaymentLinkUrl(username, publicId),
      recipientAddress,
    };
  }

  const paymentLinks: Omit<PaymentLinkDoc, "_id">[] = [
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 10,
      tokenId: "usdc",
      networkId: "base",
      status: "pending",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    }),
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 25,
      tokenId: "usdc",
      networkId: "ethereum",
      status: "paid",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      paidAt: now,
      paidBy: recipientAddress,
      paidTxHash: "0xseed000000000000000000000000000000000000000000000000000000000001",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    }),
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 50,
      tokenId: "usdc",
      networkId: "polygon",
      status: "pending",
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    }),
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 100,
      tokenId: "usdc",
      networkId: "arbitrum",
      status: "paid",
      expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      paidAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      paidBy: recipientAddress,
      paidTxHash: "0xseed000000000000000000000000000000000000000000000000000000000002",
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    }),
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 15,
      tokenId: "usdc",
      networkId: "base",
      status: "expired",
      expiresAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    }),
    buildSeedLink({
      workspaceId,
      createdBy: userId,
      amount: 75,
      tokenId: "usdc",
      networkId: "base",
      status: "pending",
      expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      updatedAt: now,
    }),
  ];

  const linkResult = await db.collection(COLLECTIONS.paymentLinks).insertMany(paymentLinks);
  const linkIds = Object.values(linkResult.insertedIds);

  const transactions: Omit<TransactionDoc, "_id">[] = [
    {
      workspaceId,
      paymentLinkId: linkIds[0],
      type: "payment_received",
      label: "Payment received",
      amount: 10,
      symbol: "USDC",
      networkId: "base",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      paymentLinkId: linkIds[1],
      type: "payment_received",
      label: "Payment received",
      amount: 25,
      symbol: "USDC",
      networkId: "ethereum",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      label: "Payment received",
      amount: 8,
      symbol: "USDC",
      networkId: "polygon",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      label: "Payment received",
      amount: 120,
      symbol: "USDC",
      networkId: "arbitrum",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      label: "Payment received",
      amount: 45,
      symbol: "USDC",
      networkId: "base",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      label: "Payment received",
      amount: 16,
      symbol: "USDC",
      networkId: "base",
      status: "confirmed",
      occurredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      createdAt: now,
    },
  ];

  const activities: Omit<ActivityEventDoc, "_id">[] = [
    {
      workspaceId,
      type: "login",
      summary: "Logged in via Google",
      meta: "",
      occurredAt: new Date(now.getTime() - 5 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_link_created",
      summary: "Payment link created · 10 USDC",
      meta: "",
      occurredAt: new Date(now.getTime() - 15 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      summary: "Payment received · 25 USDC",
      meta: "",
      status: "settled",
      occurredAt: new Date(now.getTime() - 45 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "invoice_created",
      summary: "Invoice created · INV-2026-0042",
      meta: "",
      occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_link_created",
      summary: "Payment link created · 50 USDC",
      meta: "",
      occurredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "logout",
      summary: "Logged out",
      meta: "",
      occurredAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      createdAt: now,
    },
    {
      workspaceId,
      type: "payment_received",
      summary: "Payment received · 100 USDC",
      meta: "",
      status: "settled",
      occurredAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      createdAt: now,
    },
  ];

  const balances: Omit<BalanceDoc, "_id">[] = [
    {
      workspaceId,
      tokenId: "usdc",
      label: "USDC",
      amount: 1240,
      updatedAt: now,
    },
    {
      workspaceId,
      tokenId: "eth",
      label: "Ethereum",
      amount: 0.42,
      updatedAt: now,
    },
    {
      workspaceId,
      tokenId: "sol",
      label: "Solana",
      amount: 12.4,
      updatedAt: now,
    },
  ];

  await Promise.all([
    db.collection(COLLECTIONS.transactions).insertMany(transactions),
    db.collection(COLLECTIONS.activityEvents).insertMany(activities),
    db.collection(COLLECTIONS.balances).insertMany(balances),
  ]);

  return { seeded: true };
}
