import { randomBytes } from "crypto";
import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { logActivity } from "@/lib/db/activity";
import type { AgentDoc } from "@/lib/db/merchant-types";
import { getPaymentIntentTtlMs } from "@/lib/pay/config";
import { validateRecipientAddress } from "@/lib/pay/recipient-address";
import type { PaymentIntentDoc, PaymentIntentStatus } from "@/lib/pay/types";
import { getSavedAddress } from "@/lib/db/saved-addresses";

function generateIntentId() {
  return `pi_${randomBytes(8).toString("hex")}`;
}

export async function createPaymentIntent(input: {
  workspaceId: ObjectId;
  agent: AgentDoc;
  type: "link" | "profile" | "address";
  linkUsername?: string;
  linkPublicId?: string;
  recipientUsername?: string;
  recipientAddress?: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
  savedAddressId?: ObjectId;
  idempotencyKey?: string;
  /** When true, intent is created already approved for background wallet sign. */
  autoExecute?: boolean;
}) {
  const db = await getDb();
  const { ensurePayIndexes } = await import("@/lib/db/pay-indexes");
  await ensurePayIndexes();

  if (input.type === "address") {
    if (
      input.amount == null ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0 ||
      !input.tokenId?.trim() ||
      !input.networkId?.trim() ||
      !input.recipientAddress?.trim()
    ) {
      return {
        ok: false as const,
        error: "recipientAddress, amount, tokenId, and networkId are required for address intents",
        code: "INVALID_REQUEST" as const,
      };
    }

    const validated = validateRecipientAddress(input.recipientAddress, input.networkId);
    if (!validated.ok) {
      return { ok: false as const, error: validated.error, code: "INVALID_ADDRESS" as const };
    }
  }

  if (input.type === "profile") {
    if (
      !input.recipientUsername?.trim() ||
      input.amount == null ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0 ||
      !input.tokenId?.trim() ||
      !input.networkId?.trim()
    ) {
      return {
        ok: false as const,
        error:
          "recipientUsername, amount, tokenId, and networkId are required for profile intents",
        code: "INVALID_REQUEST" as const,
      };
    }
  }

  if (input.savedAddressId) {
    const address = await getSavedAddress(input.workspaceId, input.savedAddressId);
    if (!address) {
      return { ok: false as const, error: "Saved address not found", code: "NOT_FOUND" as const };
    }
  }

  if (input.idempotencyKey) {
    const existing = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOne({
      workspaceId: input.workspaceId,
      agentObjectId: input.agent._id,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) {
      return { ok: true as const, intent: existing, created: false as const };
    }
  }

  const now = new Date();
  const intentId = generateIntentId();
  const expiresAt = new Date(now.getTime() + getPaymentIntentTtlMs());
  const autoExecute = input.autoExecute === true;
  let normalizedRecipientAddress: string | undefined;
  if (input.type === "address" && input.recipientAddress && input.networkId) {
    const validated = validateRecipientAddress(input.recipientAddress, input.networkId);
    normalizedRecipientAddress = validated.ok ? validated.address : input.recipientAddress.trim();
  }

  const doc: Omit<PaymentIntentDoc, "_id"> = {
    intentId,
    workspaceId: input.workspaceId,
    agentObjectId: input.agent._id,
    externalAgentId: input.agent.externalAgentId,
    status: autoExecute ? "approved" : "pending",
    type: input.type,
    linkUsername: input.linkUsername,
    linkPublicId: input.linkPublicId,
    recipientUsername: input.recipientUsername,
    recipientAddress: normalizedRecipientAddress,
    amount: input.amount,
    tokenId: input.tokenId,
    networkId: input.networkId,
    savedAddressId: input.savedAddressId,
    idempotencyKey: input.idempotencyKey,
    autoExecute: autoExecute ? true : undefined,
    approvedAt: autoExecute ? now : undefined,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTIONS.paymentIntents).insertOne(doc as PaymentIntentDoc);
  const intent = { ...doc, _id: result.insertedId } as PaymentIntentDoc;

  await logActivity({
    workspaceId: input.workspaceId,
    type: autoExecute ? "payment_intent_approved" : "payment_intent_created",
    summary: autoExecute
      ? `Auto-approved agent payment · ${input.agent.name ?? input.agent.publicId}`
      : `Payment approval requested · ${input.agent.name ?? input.agent.publicId}`,
  });

  return { ok: true as const, intent, created: true as const };
}

export async function getPaymentIntentByIntentId(intentId: string) {
  const db = await getDb();
  const intent = await db
    .collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents)
    .findOne({ intentId });

  if (!intent) return null;
  return refreshExpiredIntent(intent);
}

export async function getPaymentIntentForWorkspace(
  workspaceId: ObjectId,
  intentId: string,
) {
  const db = await getDb();
  const intent = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOne({
    workspaceId,
    intentId,
  });
  if (!intent) return null;
  return refreshExpiredIntent(intent);
}

async function refreshExpiredIntent(intent: PaymentIntentDoc) {
  if (intent.status !== "pending" || intent.expiresAt > new Date()) {
    return intent;
  }

  const db = await getDb();
  const now = new Date();
  await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).updateOne(
    { _id: intent._id, status: "pending" },
    { $set: { status: "expired", updatedAt: now } },
  );
  return { ...intent, status: "expired" as PaymentIntentStatus };
}

export async function listPendingPaymentIntents(workspaceId: ObjectId) {
  const db = await getDb();
  const now = new Date();
  const intents = await db
    .collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents)
    .find({
      workspaceId,
      status: "pending",
      expiresAt: { $gt: now },
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return intents;
}

/** Pending (unexpired) or approved-but-not-yet-settled intents for the portal popup. */
export async function listActionablePaymentIntents(workspaceId: ObjectId) {
  const db = await getDb();
  const now = new Date();
  const intents = await db
    .collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents)
    .find({
      workspaceId,
      $or: [
        { status: "pending", expiresAt: { $gt: now }, autoExecute: { $ne: true } },
        { status: "approved", autoExecute: { $ne: true } },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return intents;
}

/** Manual approval queue — excludes auto-execute (in-mandate) intents. */
export async function listManualActionablePaymentIntents(workspaceId: ObjectId) {
  return listActionablePaymentIntents(workspaceId);
}

/** Approved in-mandate intents awaiting background wallet sign. */
export async function listAutoExecutePaymentIntents(workspaceId: ObjectId) {
  const db = await getDb();
  const intents = await db
    .collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents)
    .find({
      workspaceId,
      status: "approved",
      autoExecute: true,
    })
    .sort({ createdAt: 1 })
    .limit(10)
    .toArray();

  return intents;
}

export async function approvePaymentIntent(input: {
  workspaceId: ObjectId;
  intentId: string;
  approvalId?: string;
  complianceDecisionId?: string;
  autoExecute?: boolean;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOneAndUpdate(
    {
      workspaceId: input.workspaceId,
      intentId: input.intentId,
      status: "pending",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "approved",
        autoExecute: input.autoExecute ?? false,
        approvalId: input.approvalId,
        complianceDecisionId: input.complianceDecisionId,
        approvedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Payment intent not found or expired" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "payment_intent_approved",
    summary: `Payment approved · ${result.externalAgentId}`,
  });

  return { ok: true as const, intent: result };
}

export async function rejectPaymentIntent(input: {
  workspaceId: ObjectId;
  intentId: string;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOneAndUpdate(
    {
      workspaceId: input.workspaceId,
      intentId: input.intentId,
      status: "pending",
    },
    {
      $set: {
        status: "rejected",
        rejectedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Payment intent not found" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "payment_intent_rejected",
    summary: `Payment declined · ${result.externalAgentId}`,
  });

  return { ok: true as const, intent: result };
}

/** Decline pending or approved-but-unpaid intents (e.g. stale queue cleanup). */
export async function rejectActionablePaymentIntent(input: {
  workspaceId: ObjectId;
  intentId: string;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOneAndUpdate(
    {
      workspaceId: input.workspaceId,
      intentId: input.intentId,
      status: { $in: ["pending", "approved"] },
    },
    {
      $set: {
        status: "rejected",
        rejectedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Payment intent not found" };
  }

  await logActivity({
    workspaceId: input.workspaceId,
    type: "payment_intent_rejected",
    summary: `Payment declined · ${result.externalAgentId}`,
  });

  return { ok: true as const, intent: result };
}

export async function rejectActionablePaymentIntentsForAgent(input: {
  workspaceId: ObjectId;
  agentObjectId: ObjectId;
  exceptIntentId?: string;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).updateMany(
    {
      workspaceId: input.workspaceId,
      agentObjectId: input.agentObjectId,
      status: { $in: ["pending", "approved"] },
      ...(input.exceptIntentId ? { intentId: { $ne: input.exceptIntentId } } : {}),
    },
    {
      $set: {
        status: "rejected",
        rejectedAt: now,
        updatedAt: now,
      },
    },
  );

  return { ok: true as const, rejectedCount: result.modifiedCount };
}

export async function consumePaymentIntent(input: {
  workspaceId: ObjectId;
  intentId: string;
  txHash: string;
}) {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).findOneAndUpdate(
    {
      workspaceId: input.workspaceId,
      intentId: input.intentId,
      status: "approved",
    },
    {
      $set: {
        status: "consumed",
        txHash: input.txHash,
        consumedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    return { ok: false as const, error: "Approved payment intent not found" };
  }

  return { ok: true as const, intent: result };
}

export async function expireStalePaymentIntents() {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection<PaymentIntentDoc>(COLLECTIONS.paymentIntents).updateMany(
    { status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "expired", updatedAt: now } },
  );
  return result.modifiedCount;
}

export function serializePaymentIntent(intent: PaymentIntentDoc) {
  return {
    intentId: intent.intentId,
    status: intent.status,
    type: intent.type,
    externalAgentId: intent.externalAgentId,
    linkUsername: intent.linkUsername,
    linkPublicId: intent.linkPublicId,
    recipientUsername: intent.recipientUsername,
    recipientAddress: intent.recipientAddress,
    amount: intent.amount,
    tokenId: intent.tokenId,
    networkId: intent.networkId,
    savedAddressId: intent.savedAddressId?.toString(),
    approvalId: intent.approvalId,
    complianceDecisionId: intent.complianceDecisionId,
    autoExecute: intent.autoExecute ?? false,
    txHash: intent.txHash,
    expiresAt: intent.expiresAt.toISOString(),
    approvedAt: intent.approvedAt?.toISOString(),
    rejectedAt: intent.rejectedAt?.toISOString(),
    consumedAt: intent.consumedAt?.toISOString(),
    createdAt: intent.createdAt.toISOString(),
  };
}
