import type { ObjectId } from "mongodb";

import { getTokenById } from "@/lib/create-payment-link-data";
import { logPaymentSentActivity } from "@/lib/db/activity";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  normalizePaymentAddress,
  normalizeTxHash,
} from "@/lib/payment/normalize";
import type { TransactionDoc, UserDoc } from "@/lib/db/types";

export async function getWorkspaceForWalletAddress(
  address: string,
  networkId?: string,
) {
  const db = await getDb();
  const normalized = networkId
    ? normalizePaymentAddress(address, networkId)
    : address.trim();

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    walletAddresses: normalized,
  });

  if (!user) return null;
  return getWorkspaceForUser(user._id);
}

export async function recordPaymentSentForPayer(input: {
  payerAddress: string;
  merchantWorkspaceId: ObjectId;
  amount: number;
  tokenId: string;
  networkId: string;
  txHash: string;
  merchantLabel: string;
  paymentLinkId?: ObjectId;
}) {
  const payerWorkspace = await getWorkspaceForWalletAddress(
    input.payerAddress,
    input.networkId,
  );
  if (!payerWorkspace) {
    return { recorded: false as const, reason: "payer_not_registered" as const };
  }

  if (payerWorkspace._id.equals(input.merchantWorkspaceId)) {
    return { recorded: false as const, reason: "same_workspace" as const };
  }

  const db = await getDb();
  const now = new Date();
  const normalizedTxHash = normalizeTxHash(input.txHash, input.networkId);
  const token = getTokenById(input.tokenId);

  const existing = await db.collection<TransactionDoc>(COLLECTIONS.transactions).findOne({
    workspaceId: payerWorkspace._id,
    txHash: normalizedTxHash,
    type: "payment_sent",
  });

  if (existing) {
    return { recorded: false as const, reason: "duplicate" as const };
  }

  try {
    await db.collection(COLLECTIONS.transactions).insertOne({
      workspaceId: payerWorkspace._id,
      ...(input.paymentLinkId ? { paymentLinkId: input.paymentLinkId } : {}),
      type: "payment_sent",
      label: `Payment to ${input.merchantLabel}`,
      amount: input.amount,
      symbol: token?.symbol?.toLowerCase() ?? input.tokenId,
      networkId: input.networkId,
      txHash: normalizedTxHash,
      recipientAddress: input.merchantLabel,
      status: "confirmed",
      occurredAt: now,
      createdAt: now,
    } satisfies Omit<TransactionDoc, "_id">);
  } catch (error) {
    const isDuplicate =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (isDuplicate) {
      return { recorded: false as const, reason: "duplicate" as const };
    }

    throw error;
  }

  await logPaymentSentActivity({
    workspaceId: payerWorkspace._id,
    amount: input.amount,
    tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
    merchantLabel: input.merchantLabel,
  });

  return { recorded: true as const, workspaceId: payerWorkspace._id };
}
