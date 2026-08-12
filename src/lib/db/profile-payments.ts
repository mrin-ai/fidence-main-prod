import type { ObjectId } from "mongodb";

import { findTransactionByWorkspaceTxHash } from "@/lib/db/transaction-txhash";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { logProfilePaymentReceivedActivity } from "@/lib/db/activity";
import { recordPaymentSentForPayer } from "@/lib/db/payment-sent";
import { getTokenById } from "@/lib/create-payment-link-data";
import { getSettlementVerifier } from "@/lib/payment/settlement";
import {
  normalizePaymentAddress,
  normalizeTxHash,
} from "@/lib/payment/normalize";
import { incrementDailyStat } from "@/lib/db/workspace-stats";
import type { TransactionDoc } from "@/lib/db/types";

export async function findTransactionByTxHash(
  txHash: string,
  networkId?: string,
  workspaceId?: import("mongodb").ObjectId,
) {
  if (workspaceId) {
    return findTransactionByWorkspaceTxHash(workspaceId, txHash, networkId);
  }
  const db = await getDb();
  const normalized = networkId
    ? normalizeTxHash(txHash, networkId)
    : txHash.trim();
  return db.collection<TransactionDoc>(COLLECTIONS.transactions).findOne({
    txHash: normalized,
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
  paidVia?: "human" | "agent";
  payerAgentId?: ObjectId;
  payerAgentPublicId?: string;
  payerWorkspaceId?: ObjectId;
  preVerified?: boolean;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedTxHash = normalizeTxHash(input.txHash, input.networkId);
  const normalizedPayerAddress = normalizePaymentAddress(
    input.payerAddress,
    input.networkId,
  );
  const normalizedRecipientAddress = normalizePaymentAddress(
    input.recipientAddress,
    input.networkId,
  );
  const token = getTokenById(input.tokenId);

  const existing = await findTransactionByWorkspaceTxHash(
    input.workspaceId,
    normalizedTxHash,
    input.networkId,
  );
  if (existing) {
    return {
      ok: true as const,
      transactionId: existing._id.toString(),
      duplicate: true,
    };
  }

  let settledAmount = input.amount;

  if (!input.preVerified) {
    const verifier = getSettlementVerifier();
    const verified = await verifier.verifySettlementDetailed(
      {
        recipientAddress: normalizedRecipientAddress,
        amount: input.amount,
        tokenId: input.tokenId,
        networkId: input.networkId,
        payerAddress: normalizedPayerAddress,
      },
      normalizedTxHash,
    );

    if (!verified.ok) {
      return { ok: false as const, error: "Payment verification failed", code: "SETTLEMENT_FAILED" as const };
    }

    settledAmount =
      Number.isFinite(verified.observedAmount) && verified.observedAmount > 0
        ? verified.observedAmount
        : input.amount;
  }

  const label = `Profile payment from ${normalizedPayerAddress.slice(0, 6)}…${normalizedPayerAddress.slice(-4)}`;

  try {
    const result = await db.collection(COLLECTIONS.transactions).insertOne({
      workspaceId: input.workspaceId,
      type: "profile_payment",
      label,
      amount: settledAmount,
      symbol: token?.symbol?.toLowerCase() ?? input.tokenId,
      networkId: input.networkId,
      txHash: normalizedTxHash,
      payerAddress: normalizedPayerAddress,
      recipientUserId: input.recipientUserId,
      recipientAddress: normalizedRecipientAddress,
      status: "confirmed",
      occurredAt: now,
      createdAt: now,
    } satisfies Omit<TransactionDoc, "_id">);

    await logProfilePaymentReceivedActivity({
      workspaceId: input.workspaceId,
      amount: settledAmount,
      tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
      username: input.username,
    });

    await incrementDailyStat(
      input.workspaceId,
      "receivedAmount",
      settledAmount,
      now,
    );

    await recordPaymentSentForPayer({
      payerAddress: normalizedPayerAddress,
      merchantWorkspaceId: input.workspaceId,
      amount: settledAmount,
      tokenId: input.tokenId,
      networkId: input.networkId,
      txHash: normalizedTxHash,
      merchantLabel: `@${input.username}`,
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

    return {
      ok: true as const,
      transactionId: result.insertedId.toString(),
      duplicate: false,
      observedAmount: settledAmount,
    };
  } catch (error) {
    const isDuplicate =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    if (isDuplicate) {
      const dup = await findTransactionByWorkspaceTxHash(
        input.workspaceId,
        normalizedTxHash,
        input.networkId,
      );
      return {
        ok: true as const,
        transactionId: dup?._id.toString() ?? "",
        duplicate: true,
      };
    }
    throw error;
  }
}
