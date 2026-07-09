import type { ObjectId } from "mongodb";

import { getTokenById } from "@/lib/create-payment-link-data";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { logProfilePaymentReceivedActivity } from "@/lib/db/activity";
import { getSettlementVerifier } from "@/lib/payment/settlement";
import type { TransactionDoc } from "@/lib/db/types";

const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

export function checkProfilePayRateLimit(key: string) {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return true;
}

export async function findTransactionByTxHash(txHash: string) {
  const db = await getDb();
  return db.collection<TransactionDoc>(COLLECTIONS.transactions).findOne({
    txHash: txHash.toLowerCase(),
  });
}

export async function recordProfilePayment(input: {
  workspaceId: ObjectId;
  recipientUserId: ObjectId;
  recipientAddress: string;
  payerAddress: string;
  amount: number;
  tokenId: string;
  networkId: string;
  txHash: string;
  username: string;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedTxHash = input.txHash.toLowerCase();
  const token = getTokenById(input.tokenId);

  const existing = await findTransactionByTxHash(normalizedTxHash);
  if (existing) {
    return {
      ok: true as const,
      transactionId: existing._id.toString(),
      duplicate: true,
    };
  }

  const verifier = getSettlementVerifier();
  const verified = await verifier.verifySettlement(
    {
      recipientAddress: input.recipientAddress,
      amount: input.amount,
      tokenId: input.tokenId,
      networkId: input.networkId,
      payerAddress: input.payerAddress,
    },
    normalizedTxHash,
  );

  if (!verified) {
    return { ok: false as const, error: "Payment verification failed" };
  }

  const label = `Profile payment from ${input.payerAddress.slice(0, 6)}…${input.payerAddress.slice(-4)}`;

  const result = await db.collection(COLLECTIONS.transactions).insertOne({
    workspaceId: input.workspaceId,
    type: "profile_payment",
    label,
    amount: input.amount,
    symbol: token?.symbol.toLowerCase() ?? input.tokenId,
    networkId: input.networkId,
    txHash: normalizedTxHash,
    payerAddress: input.payerAddress.toLowerCase(),
    recipientUserId: input.recipientUserId,
    recipientAddress: input.recipientAddress.toLowerCase(),
    status: "confirmed",
    occurredAt: now,
    createdAt: now,
  } satisfies Omit<TransactionDoc, "_id">);

  await logProfilePaymentReceivedActivity({
    workspaceId: input.workspaceId,
    amount: input.amount,
    tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
    username: input.username,
  });

  return {
    ok: true as const,
    transactionId: result.insertedId.toString(),
    duplicate: false,
  };
}
