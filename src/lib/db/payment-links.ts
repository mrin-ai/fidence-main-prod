import { ObjectId } from "mongodb";
import {
  buildPaymentLinkUrl,
  generatePublicId,
} from "@/lib/payment-link-url";
import {
  getNetworkById,
  getTokenById,
} from "@/lib/create-payment-link-data";
import {
  logPaymentLinkCreatedActivity,
  logPaymentReceivedActivity,
} from "@/lib/db/activity";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { PaymentLinkDoc, PaymentLinkStatus, UserDoc } from "@/lib/db/types";
import type { PublicPaymentLink } from "@/lib/payment-link-types";
import { formatPaymentDateTime } from "@/lib/format-date";

export type { PublicPaymentLink };

function resolveStatus(link: PaymentLinkDoc, now = new Date()): PaymentLinkStatus {
  if (link.status === "paid" || link.status === "cancelled") {
    return link.status;
  }
  if (link.expiresAt.getTime() < now.getTime()) {
    return "expired";
  }
  return link.status;
}

async function syncExpiredStatus(link: PaymentLinkDoc) {
  const now = new Date();
  const resolved = resolveStatus(link, now);

  if (link.status === "pending" && resolved === "expired") {
    const db = await getDb();
    await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).updateOne(
      { _id: link._id, status: "pending" },
      { $set: { status: "expired", updatedAt: now } },
    );
    return { ...link, status: "expired" as const, updatedAt: now };
  }

  return link;
}

function toPublicPaymentLink(
  link: PaymentLinkDoc,
  merchant: Pick<UserDoc, "name">,
): PublicPaymentLink {
  const status = resolveStatus(link);
  const token = getTokenById(link.tokenId);
  const network = getNetworkById(link.networkId);

  return {
    username: link.username,
    publicId: link.publicId,
    url: link.url,
    amount: link.amount,
    tokenId: link.tokenId,
    tokenSymbol: token?.symbol ?? link.tokenId.toUpperCase(),
    networkId: link.networkId,
    networkLabel: network?.label ?? link.networkId,
    status,
    expiresAt: link.expiresAt.toISOString(),
    expiresAtLabel: formatPaymentDateTime(link.expiresAt),
    paidAt: link.paidAt?.toISOString(),
    paidAtLabel: link.paidAt
      ? formatPaymentDateTime(link.paidAt)
      : undefined,
    paidBy: link.paidBy,
    paidTxHash: link.paidTxHash,
    recipientAddress: link.recipientAddress,
    merchantName: merchant.name,
    canPay:
      status === "pending" &&
      Boolean(link.recipientAddress) &&
      link.networkId !== "solana",
  };
}

export async function createPaymentLink(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  username: string;
  recipientAddress?: string;
  amount: number;
  tokenId: string;
  networkId: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  const now = new Date();
  const publicId = generatePublicId();
  const url = buildPaymentLinkUrl(input.username, publicId);

  const status: PaymentLinkStatus =
    input.expiresAt.getTime() < now.getTime() ? "expired" : "pending";

  const doc: Omit<PaymentLinkDoc, "_id"> = {
    workspaceId: input.workspaceId,
    createdBy: input.userId,
    username: input.username,
    publicId,
    slug: publicId,
    url,
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    recipientAddress: input.recipientAddress?.toLowerCase(),
    status,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.paymentLinks).insertOne(doc);
  const token = getTokenById(input.tokenId);

  await logPaymentLinkCreatedActivity({
    workspaceId: input.workspaceId,
    amount: input.amount,
    tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
  });

  return {
    id: result.insertedId.toString(),
    publicId,
    url,
    status,
  };
}

export async function getPaymentLinkByUsernameAndPublicId(
  username: string,
  publicId: string,
) {
  const db = await getDb();
  const normalizedUsername = username.trim().toLowerCase();

  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    username: normalizedUsername,
    publicId,
  });

  if (!link) return null;

  const syncedLink = await syncExpiredStatus(link);
  const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: syncedLink.createdBy,
  });

  if (!merchant) return null;

  return toPublicPaymentLink(syncedLink, merchant);
}

export async function markPaymentLinkPaid(input: {
  username: string;
  publicId: string;
  payerAddress: string;
  txHash: string;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedUsername = input.username.trim().toLowerCase();
  const payerAddress = input.payerAddress.toLowerCase();

  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    username: normalizedUsername,
    publicId: input.publicId,
  });

  if (!link) {
    return { ok: false as const, error: "Payment link not found" };
  }

  const syncedLink = await syncExpiredStatus(link);
  const status = resolveStatus(syncedLink, now);

  if (status === "paid") {
    return { ok: false as const, error: "This link has already been paid" };
  }

  if (status === "expired") {
    return { ok: false as const, error: "This payment link has expired" };
  }

  if (status === "cancelled") {
    return { ok: false as const, error: "This payment link is no longer active" };
  }

  const token = getTokenById(syncedLink.tokenId);

  await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).updateOne(
    { _id: syncedLink._id, status: "pending" },
    {
      $set: {
        status: "paid",
        paidAt: now,
        paidBy: payerAddress,
        paidTxHash: input.txHash,
        updatedAt: now,
      },
    },
  );

  await db.collection(COLLECTIONS.transactions).insertOne({
    workspaceId: syncedLink.workspaceId,
    paymentLinkId: syncedLink._id,
    type: "payment_received",
    label: `Payment from ${payerAddress.slice(0, 6)}…${payerAddress.slice(-4)}`,
    amount: syncedLink.amount,
    symbol: token?.symbol.toLowerCase() ?? syncedLink.tokenId,
    networkId: syncedLink.networkId,
    txHash: input.txHash,
    status: "confirmed",
    occurredAt: now,
    createdAt: now,
  });

  await logPaymentReceivedActivity({
    workspaceId: syncedLink.workspaceId,
    amount: syncedLink.amount,
    tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
  });

  const updated = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    _id: syncedLink._id,
  });

  if (!updated) {
    return { ok: false as const, error: "Failed to load updated payment link" };
  }

  const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: updated.createdBy,
  });

  if (!merchant) {
    return { ok: false as const, error: "Merchant not found" };
  }

  return {
    ok: true as const,
    link: toPublicPaymentLink(updated, merchant),
  };
}

export async function listPaymentLinks(workspaceId: ObjectId) {
  const db = await getDb();
  const links = await db
    .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .toArray();

  return Promise.all(links.map((link) => syncExpiredStatus(link)));
}

export async function deletePaymentLink(
  workspaceId: ObjectId,
  paymentLinkId: string,
) {
  const db = await getDb();
  await db.collection(COLLECTIONS.paymentLinks).deleteOne({
    _id: new ObjectId(paymentLinkId),
    workspaceId,
  });
}
