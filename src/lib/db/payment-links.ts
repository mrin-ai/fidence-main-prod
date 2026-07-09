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
  logInvoicePaidActivity,
  logInvoicePaymentLinkCreatedActivity,
  logInvoicePaymentLinkUpdatedActivity,
  logPaymentLinkCreatedActivity,
  logPaymentReceivedActivity,
} from "@/lib/db/activity";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { incrementDailyStat } from "@/lib/db/workspace-stats";
import type { PaymentLinkDoc, PaymentLinkStatus, UserDoc, InvoiceDoc } from "@/lib/db/types";
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
  invoiceReference?: string,
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
    invoiceReference,
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
  invoiceId?: ObjectId;
  logActivity?: boolean;
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
    ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
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

  if (input.logActivity !== false && !input.invoiceId) {
    await logPaymentLinkCreatedActivity({
      workspaceId: input.workspaceId,
      amount: input.amount,
      tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
    });
  }

  if (!input.invoiceId) {
    await incrementDailyStat(input.workspaceId, "linksCreated", 1, now);
    if (status === "pending") {
      await incrementDailyStat(input.workspaceId, "linksPending", 1, now);
    }
  }

  return {
    id: result.insertedId.toString(),
    publicId,
    url,
    status,
  };
}

export async function upsertInvoicePaymentLink(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  username: string;
  recipientAddress: string;
  invoiceId: ObjectId;
  paymentLinkId?: ObjectId;
  amount: number;
  tokenId: string;
  networkId: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  const now = new Date();

  if (input.paymentLinkId) {
    const existing = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
      _id: input.paymentLinkId,
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
    });

    if (existing) {
      if (existing.status === "paid") {
        return {
          id: existing._id.toString(),
          publicId: existing.publicId,
          url: existing.url,
          status: existing.status,
          amount: existing.amount,
          tokenId: existing.tokenId,
          networkId: existing.networkId,
        };
      }

      await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).updateOne(
        { _id: existing._id },
        {
          $set: {
            amount: input.amount,
            tokenId: input.tokenId,
            networkId: input.networkId,
            recipientAddress: input.recipientAddress.toLowerCase(),
            expiresAt: input.expiresAt,
            updatedAt: now,
            status:
              input.expiresAt.getTime() < now.getTime() ? "expired" : "pending",
          },
        },
      );

      const updated = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
        _id: existing._id,
      });

      if (!updated) {
        throw new Error("Failed to load updated invoice payment link");
      }

      const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
        _id: input.invoiceId,
      });
      const token = getTokenById(input.tokenId);
      if (invoice) {
        await logInvoicePaymentLinkUpdatedActivity({
          workspaceId: input.workspaceId,
          reference: invoice.reference,
          amount: input.amount,
          tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
        });
      }

      return {
        id: updated._id.toString(),
        publicId: updated.publicId,
        url: updated.url,
        status: resolveStatus(updated),
        amount: updated.amount,
        tokenId: updated.tokenId,
        networkId: updated.networkId,
      };
    }
  }

  const createdLink = await createPaymentLink({
    workspaceId: input.workspaceId,
    userId: input.userId,
    username: input.username,
    recipientAddress: input.recipientAddress,
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    expiresAt: input.expiresAt,
    invoiceId: input.invoiceId,
    logActivity: false,
  });

  const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
    _id: input.invoiceId,
  });
  const token = getTokenById(input.tokenId);
  if (invoice) {
    await logInvoicePaymentLinkCreatedActivity({
      workspaceId: input.workspaceId,
      reference: invoice.reference,
      amount: input.amount,
      tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
    });
  }

  return {
    ...createdLink,
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
  };
}

export async function getInvoicePaymentLinkById(
  workspaceId: ObjectId,
  paymentLinkId: ObjectId,
) {
  const db = await getDb();
  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    _id: paymentLinkId,
    workspaceId,
    invoiceId: { $exists: true },
  });

  if (!link) return null;

  const syncedLink = await syncExpiredStatus(link);

  return {
    id: syncedLink._id.toString(),
    publicId: syncedLink.publicId,
    url: syncedLink.url,
    status: resolveStatus(syncedLink),
    amount: syncedLink.amount,
    tokenId: syncedLink.tokenId,
    networkId: syncedLink.networkId,
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

  let invoiceReference: string | undefined;
  if (syncedLink.invoiceId) {
    const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
      _id: syncedLink.invoiceId,
    });
    invoiceReference = invoice?.reference;
  }

  return toPublicPaymentLink(syncedLink, merchant, invoiceReference);
}

export async function markPaymentLinkPaid(input: {
  username: string;
  publicId: string;
  payerAddress: string;
  txHash: string;
  logActivity?: boolean;
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
    label: syncedLink.invoiceId
      ? `Invoice payment`
      : `Payment from ${payerAddress.slice(0, 6)}…${payerAddress.slice(-4)}`,
    amount: syncedLink.amount,
    symbol: token?.symbol?.toLowerCase() ?? syncedLink.tokenId,
    networkId: syncedLink.networkId,
    txHash: input.txHash,
    status: "confirmed",
    occurredAt: now,
    createdAt: now,
  });

  if (!syncedLink.invoiceId) {
    await incrementDailyStat(syncedLink.workspaceId, "linksPaid", 1, now);
    await incrementDailyStat(
      syncedLink.workspaceId,
      "receivedAmount",
      syncedLink.amount,
      now,
    );
  }

  if (syncedLink.invoiceId) {
    await db.collection<InvoiceDoc>(COLLECTIONS.invoices).updateOne(
      { _id: syncedLink.invoiceId, status: { $ne: "cancelled" } },
      {
        $set: {
          status: "paid",
          paidAt: now,
          updatedAt: now,
        },
      },
    );
  }

  if (input.logActivity !== false) {
    await logPaymentReceivedActivity({
      workspaceId: syncedLink.workspaceId,
      amount: syncedLink.amount,
      tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
    });

    if (syncedLink.invoiceId) {
      const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
        _id: syncedLink.invoiceId,
      });
      if (invoice) {
        await logInvoicePaidActivity({
          workspaceId: syncedLink.workspaceId,
          reference: invoice.reference,
          amount: syncedLink.amount,
          tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
        });
      }
    }
  }

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

  let invoiceReference: string | undefined;
  if (updated.invoiceId) {
    const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
      _id: updated.invoiceId,
    });
    invoiceReference = invoice?.reference;
  }

  return {
    ok: true as const,
    link: toPublicPaymentLink(updated, merchant, invoiceReference),
  };
}

export async function listPaymentLinks(workspaceId: ObjectId) {
  const db = await getDb();
  const links = await db
    .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
    .find({
      workspaceId,
      invoiceId: { $exists: false },
    })
    .sort({ createdAt: -1 })
    .toArray();

  return Promise.all(links.map((link) => syncExpiredStatus(link)));
}

export async function listPaymentLinksPaginated(
  workspaceId: ObjectId,
  options: {
    page?: number;
    limit?: number;
    status?: PaymentLinkStatus | "all" | "failed";
    sort?: "newest" | "oldest";
    query?: string;
  } = {},
) {
  const db = await getDb();
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    workspaceId,
    invoiceId: { $exists: false },
  };

  if (options.status && options.status !== "all") {
    if (options.status === "failed") {
      filter.status = { $in: ["expired", "cancelled"] };
    } else {
      filter.status = options.status;
    }
  }

  if (options.query?.trim()) {
    const query = options.query.trim();
    filter.$or = [
      { publicId: { $regex: query, $options: "i" } },
      { url: { $regex: query, $options: "i" } },
      { tokenId: { $regex: query, $options: "i" } },
    ];
  }

  const sortOrder = options.sort === "oldest" ? 1 : -1;

  const [links, total] = await Promise.all([
    db
      .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
      .find(filter)
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.paymentLinks).countDocuments(filter),
  ]);

  const synced = await Promise.all(links.map((link) => syncExpiredStatus(link)));

  return {
    items: synced.map(serializePaymentLinkListItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export type PaymentLinkListItem = {
  id: string;
  publicId: string;
  url: string;
  amount: number;
  amountLabel: string;
  tokenId: string;
  tokenSymbol: string;
  networkId: string;
  networkLabel: string;
  status: PaymentLinkStatus;
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
};

export function serializePaymentLinkListItem(
  link: PaymentLinkDoc,
): PaymentLinkListItem {
  const status = resolveStatus(link);
  const token = getTokenById(link.tokenId);
  const network = getNetworkById(link.networkId);
  const symbol = token?.symbol ?? link.tokenId.toUpperCase();

  return {
    id: link._id.toString(),
    publicId: link.publicId,
    url: link.url,
    amount: link.amount,
    amountLabel: `${link.amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} ${symbol}`,
    tokenId: link.tokenId,
    tokenSymbol: symbol,
    networkId: link.networkId,
    networkLabel: network?.label ?? link.networkId,
    status,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt.toISOString(),
    paidAt: link.paidAt?.toISOString(),
  };
}

export async function listPaymentLinksForWorkspace(workspaceId: ObjectId) {
  const links = await listPaymentLinks(workspaceId);
  return links.map(serializePaymentLinkListItem);
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
