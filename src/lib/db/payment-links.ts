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
  logAgentLinkCreatedActivity,
  logPaymentLinkCreatedActivity,
  logPaymentReceivedActivity,
} from "@/lib/db/activity";
import { getDb, getReadDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { buildCommerceSourceFilter } from "@/lib/db/commerce-source";
import type { CommerceSource } from "@/lib/db/merchant-types";
import { incrementAgentLinkCount } from "@/lib/db/agents";
import { recordPaymentSentForPayer } from "@/lib/db/payment-sent";
import { findTransactionByWorkspaceTxHash } from "@/lib/db/transaction-txhash";
import { incrementDailyStat } from "@/lib/db/workspace-stats";
import {
  incrementAgentPaymentStats,
} from "@/lib/db/agents";
import {
  logAgentPaymentReceivedActivity,
} from "@/lib/db/activity";
import type { PaymentLinkDoc, PaymentLinkStatus, UserDoc, InvoiceDoc } from "@/lib/db/types";
import type { PublicPaymentLink } from "@/lib/payment-link-types";
import { formatPaymentDateTime } from "@/lib/format-date";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import {
  normalizePaymentAddress,
  normalizeTxHash,
} from "@/lib/payment/normalize";
import { getSettlementVerifier } from "@/lib/payment/settlement";
import {
  getCachedPaymentLink,
  invalidatePaymentLinkCache,
  setCachedPaymentLink,
} from "@/lib/cache/payment-link-cache";
import { logActivity } from "@/lib/db/activity";

export type { PublicPaymentLink };

export async function syncPaymentLinksForUserUsername(
  userId: ObjectId,
  username: string,
) {
  const db = await getDb();
  const normalizedUsername = username.trim().toLowerCase();
  const now = new Date();

  const links = await db
    .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
    .find({ createdBy: userId })
    .project({ _id: 1, publicId: 1 })
    .toArray();

  if (links.length === 0) return;

  await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).bulkWrite(
    links.map((link) => ({
      updateOne: {
        filter: { _id: link._id },
        update: {
          $set: {
            username: normalizedUsername,
            url: buildPaymentLinkUrl(normalizedUsername, link.publicId),
            updatedAt: now,
          },
        },
      },
    })),
  );
}

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
      supportsOnChainPayment(link.networkId, link.tokenId),
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
  source?: CommerceSource;
  agentId?: ObjectId;
  agentPublicId?: string;
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
    ...(input.source ? { source: input.source } : {}),
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(input.agentPublicId ? { agentPublicId: input.agentPublicId } : {}),
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
    if (input.source === "agent" && input.agentPublicId) {
      await logAgentLinkCreatedActivity({
        workspaceId: input.workspaceId,
        agentPublicId: input.agentPublicId,
        amount: input.amount,
        tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
      });
    } else {
      await logPaymentLinkCreatedActivity({
        workspaceId: input.workspaceId,
        amount: input.amount,
        tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
      });
    }
  }

  if (input.agentId) {
    await incrementAgentLinkCount(input.agentId);
  }

  if (!input.invoiceId) {
    await incrementDailyStat(input.workspaceId, "linksCreated", 1, now);
    if (status === "pending") {
      await incrementDailyStat(input.workspaceId, "linksPending", 1, now);
    }
  }

  try {
    const { enqueueWebhookEvent } = await import("@/lib/webhooks/dispatch");
    await enqueueWebhookEvent({
      workspaceId: input.workspaceId,
      event: "payment_link.created",
      payload: {
        publicId,
        url,
        amount: input.amount,
        tokenId: input.tokenId,
        networkId: input.networkId,
        status,
        agentPublicId: input.agentPublicId ?? null,
      },
    });
  } catch {
    // Non-blocking
  }

  return {
    id: result.insertedId.toString(),
    publicId,
    url,
    status,
  };
}

export async function createPaymentLinksBatch(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  username: string;
  agentId: ObjectId;
  agentPublicId: string;
  links: Array<{
    amount: number;
    tokenId: string;
    networkId: string;
    expiresAt: Date;
    recipientAddress: string;
  }>;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedUsername = input.username.trim().toLowerCase();
  const count = input.links.length;

  const docs: Omit<PaymentLinkDoc, "_id">[] = [];
  const created: Array<{
    id: string;
    publicId: string;
    url: string;
    status: PaymentLinkStatus;
    amount: number;
    tokenId: string;
    networkId: string;
  }> = [];
  let pendingCount = 0;

  for (const linkInput of input.links) {
    const publicId = generatePublicId();
    const url = buildPaymentLinkUrl(normalizedUsername, publicId);
    const status: PaymentLinkStatus =
      linkInput.expiresAt.getTime() < now.getTime() ? "expired" : "pending";
    if (status === "pending") pendingCount += 1;

    docs.push({
      workspaceId: input.workspaceId,
      createdBy: input.userId,
      source: "agent",
      agentId: input.agentId,
      agentPublicId: input.agentPublicId,
      username: normalizedUsername,
      publicId,
      slug: publicId,
      url,
      amount: linkInput.amount,
      tokenId: linkInput.tokenId,
      networkId: linkInput.networkId,
      recipientAddress: linkInput.recipientAddress.toLowerCase(),
      status,
      expiresAt: linkInput.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  const result = await db.collection(COLLECTIONS.paymentLinks).insertMany(docs);

  const insertedIds = Object.values(result.insertedIds);
  insertedIds.forEach((insertedId, index) => {
    const doc = docs[index];
    created.push({
      id: insertedId.toString(),
      publicId: doc.publicId,
      url: doc.url,
      status: doc.status,
      amount: doc.amount,
      tokenId: doc.tokenId,
      networkId: doc.networkId,
    });
  });

  await incrementAgentLinkCount(input.agentId, count);
  await incrementDailyStat(input.workspaceId, "linksCreated", count, now);
  if (pendingCount > 0) {
    await incrementDailyStat(input.workspaceId, "linksPending", pendingCount, now);
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "agent_link_created",
    summary: `Agent batch · ${input.agentPublicId} · ${count} links`,
  });

  return created;
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
  const normalizedUsername = username.trim().toLowerCase();
  const cached = await getCachedPaymentLink(normalizedUsername, publicId);
  if (cached) return cached;

  const db = await getReadDb();

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

  const publicLink = toPublicPaymentLink(syncedLink, merchant, invoiceReference);
  await setCachedPaymentLink(normalizedUsername, publicId, publicLink);
  return publicLink;
}

export async function markPaymentLinkPaid(input: {
  username: string;
  publicId: string;
  payerAddress: string;
  txHash: string;
  logActivity?: boolean;
  paidVia?: "human" | "agent";
  payerAgentId?: import("mongodb").ObjectId;
  payerAgentPublicId?: string;
  payerWorkspaceId?: import("mongodb").ObjectId;
  /** Skip on-chain verify when caller already verified (agent path). */
  preVerified?: boolean;
  observedAmount?: number;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedUsername = input.username.trim().toLowerCase();

  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    username: normalizedUsername,
    publicId: input.publicId,
  });

  if (!link) {
    return { ok: false as const, error: "Payment link not found", code: "LINK_NOT_FOUND" as const };
  }

  const payerAddress = normalizePaymentAddress(
    input.payerAddress,
    link.networkId,
  );
  const normalizedTxHash = normalizeTxHash(input.txHash, link.networkId);

  const existingTx = await findTransactionByWorkspaceTxHash(
    link.workspaceId,
    normalizedTxHash,
    link.networkId,
  );
  if (existingTx) {
    const synced = await syncExpiredStatus(link);
    if (synced.status === "paid" && synced.paidTxHash === normalizedTxHash) {
      const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
        _id: synced.createdBy,
      });
      if (!merchant) {
        return { ok: false as const, error: "Merchant not found" };
      }
      let invoiceReference: string | undefined;
      if (synced.invoiceId) {
        const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
          _id: synced.invoiceId,
        });
        invoiceReference = invoice?.reference;
      }
      return {
        ok: true as const,
        duplicate: true as const,
        link: toPublicPaymentLink(synced, merchant, invoiceReference),
      };
    }
    return {
      ok: false as const,
      error: "Transaction hash already used for another payment",
      code: "TX_ALREADY_USED" as const,
    };
  }

  const syncedLink = await syncExpiredStatus(link);
  const status = resolveStatus(syncedLink, now);

  if (status === "paid") {
    return {
      ok: false as const,
      error: "This link has already been paid",
      code: "LINK_ALREADY_PAID" as const,
    };
  }

  if (status === "expired") {
    return { ok: false as const, error: "This payment link has expired", code: "LINK_EXPIRED" as const };
  }

  if (status === "cancelled") {
    return { ok: false as const, error: "This payment link is no longer active", code: "LINK_CANCELLED" as const };
  }

  if (!syncedLink.recipientAddress) {
    return { ok: false as const, error: "Payment link has no recipient address" };
  }

  if (!input.preVerified) {
    const verifier = getSettlementVerifier();
    const verified = await verifier.verifySettlement(
      {
        recipientAddress: syncedLink.recipientAddress,
        amount: syncedLink.amount,
        tokenId: syncedLink.tokenId,
        networkId: syncedLink.networkId,
        payerAddress,
      },
      normalizedTxHash,
    );

    if (!verified) {
      return { ok: false as const, error: "Payment verification failed", code: "SETTLEMENT_FAILED" as const };
    }
  }

  const settledAmount = input.observedAmount ?? syncedLink.amount;
  const token = getTokenById(syncedLink.tokenId);

  const updatedLink = await db
    .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
    .findOneAndUpdate(
      { _id: syncedLink._id, status: "pending" },
      {
        $set: {
          status: "paid",
          paidAt: now,
          paidBy: payerAddress,
          paidTxHash: normalizedTxHash,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

  if (!updatedLink) {
    const current = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
      _id: syncedLink._id,
    });
    if (current?.status === "paid" && current.paidTxHash === normalizedTxHash) {
      const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
        _id: current.createdBy,
      });
      if (!merchant) {
        return { ok: false as const, error: "Merchant not found" };
      }
      let invoiceReference: string | undefined;
      if (current.invoiceId) {
        const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
          _id: current.invoiceId,
        });
        invoiceReference = invoice?.reference;
      }
      return {
        ok: true as const,
        duplicate: true as const,
        link: toPublicPaymentLink(current, merchant, invoiceReference),
      };
    }
    return {
      ok: false as const,
      error: "This link has already been paid",
      code: "LINK_ALREADY_PAID" as const,
    };
  }

  try {
    await db.collection(COLLECTIONS.transactions).insertOne({
      workspaceId: syncedLink.workspaceId,
      paymentLinkId: syncedLink._id,
      type: "payment_received",
      label: syncedLink.source === "agent" && syncedLink.agentPublicId
        ? `Agent payment received · ${syncedLink.agentPublicId}`
        : syncedLink.invoiceId
          ? `Invoice payment`
          : `Payment from ${payerAddress.slice(0, 6)}…${payerAddress.slice(-4)}`,
      amount: settledAmount,
      symbol: token?.symbol?.toLowerCase() ?? syncedLink.tokenId,
      networkId: syncedLink.networkId,
      txHash: normalizedTxHash,
      ...(syncedLink.source ? { source: syncedLink.source } : {}),
      ...(syncedLink.agentId ? { agentId: syncedLink.agentId } : {}),
      status: "confirmed",
      occurredAt: now,
      createdAt: now,
    });
  } catch (error) {
    const isDuplicate =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    if (isDuplicate) {
      const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
        _id: syncedLink.createdBy,
      });
      if (!merchant) {
        return { ok: false as const, error: "Merchant not found" };
      }
      return {
        ok: true as const,
        duplicate: true as const,
        link: toPublicPaymentLink(updatedLink, merchant),
      };
    }
    throw error;
  }

  if (!syncedLink.invoiceId) {
    await incrementDailyStat(syncedLink.workspaceId, "linksPaid", 1, now);
    await incrementDailyStat(
      syncedLink.workspaceId,
      "receivedAmount",
      settledAmount,
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
    if (syncedLink.source === "agent" && syncedLink.agentPublicId) {
      await logAgentPaymentReceivedActivity({
        workspaceId: syncedLink.workspaceId,
        agentPublicId: syncedLink.agentPublicId,
        amount: settledAmount,
        tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
      });
    } else {
      await logPaymentReceivedActivity({
        workspaceId: syncedLink.workspaceId,
        amount: settledAmount,
        tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
      });
    }

    if (syncedLink.invoiceId) {
      const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
        _id: syncedLink.invoiceId,
      });
      if (invoice) {
        await logInvoicePaidActivity({
          workspaceId: syncedLink.workspaceId,
          reference: invoice.reference,
          amount: settledAmount,
          tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
        });
      }

      try {
        const { notifyInvoiceCreatorOfPayment } = await import(
          "@/lib/db/invoices"
        );
        await notifyInvoiceCreatorOfPayment({
          invoiceId: syncedLink.invoiceId,
          amount: settledAmount,
          tokenSymbol: token?.symbol ?? syncedLink.tokenId.toUpperCase(),
          paymentUrl: buildPaymentLinkUrl(
            syncedLink.username,
            syncedLink.publicId,
          ),
        });
      } catch (error) {
        console.error("Failed to send invoice paid email", error);
      }
    }
  }

  if (syncedLink.agentId) {
    await incrementAgentPaymentStats(syncedLink.agentId, {
      received: settledAmount,
    });
  }

  const merchant = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: syncedLink.createdBy,
  });

  await recordPaymentSentForPayer({
    payerAddress,
    merchantWorkspaceId: syncedLink.workspaceId,
    amount: settledAmount,
    tokenId: syncedLink.tokenId,
    networkId: syncedLink.networkId,
    txHash: normalizedTxHash,
    merchantLabel: merchant?.username
      ? `@${merchant.username}`
      : syncedLink.username,
    paymentLinkId: syncedLink._id,
    payerWorkspaceId: input.payerWorkspaceId,
    payerAttribution:
      input.paidVia === "agent" && input.payerAgentId
        ? {
            source: "agent",
            agentId: input.payerAgentId,
            agentPublicId: input.payerAgentPublicId,
          }
        : { source: "human" },
  });

  if (!merchant) {
    return { ok: false as const, error: "Merchant not found" };
  }

  await invalidatePaymentLinkCache(normalizedUsername, input.publicId);

  try {
    const { enqueueWebhookEvent } = await import("@/lib/webhooks/dispatch");
    await enqueueWebhookEvent({
      workspaceId: syncedLink.workspaceId,
      event: "payment_link.paid",
      payload: {
        publicId: syncedLink.publicId,
        username: syncedLink.username,
        amount: settledAmount,
        tokenId: syncedLink.tokenId,
        networkId: syncedLink.networkId,
        txHash: normalizedTxHash,
        payerAddress,
      },
    });
    if (input.paidVia === "agent") {
      await enqueueWebhookEvent({
        workspaceId: syncedLink.workspaceId,
        event: "agent.payment_recorded",
        payload: {
          type: "link",
          publicId: syncedLink.publicId,
          txHash: normalizedTxHash,
          agentPublicId: input.payerAgentPublicId ?? null,
        },
      });
    }
  } catch {
    // Non-blocking
  }

  let invoiceReference: string | undefined;
  if (updatedLink.invoiceId) {
    const invoice = await db.collection<InvoiceDoc>(COLLECTIONS.invoices).findOne({
      _id: updatedLink.invoiceId,
    });
    invoiceReference = invoice?.reference;
  }

  return {
    ok: true as const,
    link: toPublicPaymentLink(updatedLink, merchant, invoiceReference),
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
    source?: CommerceSource;
  } = {},
) {
  const db = await getDb();
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    workspaceId,
    invoiceId: { $exists: false },
    ...buildCommerceSourceFilter(options.source),
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
  source: CommerceSource;
  agentPublicId?: string;
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
    source: link.source ?? "human",
    agentPublicId: link.agentPublicId,
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
