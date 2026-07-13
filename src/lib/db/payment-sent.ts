import type { ObjectId } from "mongodb";

import { getTokenById } from "@/lib/create-payment-link-data";
import { logPaymentSentActivity, logAgentPaymentSentActivity } from "@/lib/db/activity";
import { getWorkspaceForUser } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { incrementDailyStat } from "@/lib/db/workspace-stats";
import { incrementAgentPaymentStats } from "@/lib/db/agents";
import type { CommerceSource } from "@/lib/db/merchant-types";
import {
  normalizePaymentAddress,
  normalizeTxHash,
} from "@/lib/payment/normalize";
import type { TransactionDoc, UserDoc } from "@/lib/db/types";

export type PayerAttribution = {
  source: CommerceSource;
  agentId?: ObjectId;
  agentPublicId?: string;
};

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
  payerAttribution?: PayerAttribution;
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

  const payerAttribution = input.payerAttribution ?? { source: "human" as const };

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
      label:
        payerAttribution.source === "agent" && payerAttribution.agentPublicId
          ? `Agent payment sent · ${payerAttribution.agentPublicId}`
          : `Payment to ${input.merchantLabel}`,
      amount: input.amount,
      symbol: token?.symbol?.toLowerCase() ?? input.tokenId,
      networkId: input.networkId,
      txHash: normalizedTxHash,
      recipientAddress: input.merchantLabel,
      source: payerAttribution.source,
      ...(payerAttribution.agentId ? { agentId: payerAttribution.agentId } : {}),
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

  if (payerAttribution.source === "agent" && payerAttribution.agentPublicId) {
    await logAgentPaymentSentActivity({
      workspaceId: payerWorkspace._id,
      agentPublicId: payerAttribution.agentPublicId,
      amount: input.amount,
      tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
    });
  } else {
    await logPaymentSentActivity({
      workspaceId: payerWorkspace._id,
      amount: input.amount,
      tokenSymbol: token?.symbol ?? input.tokenId.toUpperCase(),
      merchantLabel: input.merchantLabel,
    });
  }

  await incrementDailyStat(
    payerWorkspace._id,
    "sentAmount",
    input.amount,
    now,
  );

  if (payerAttribution.source === "agent" && payerAttribution.agentId) {
    await incrementAgentPaymentStats(payerAttribution.agentId, {
      paid: input.amount,
    });
  }

  return { recorded: true as const, workspaceId: payerWorkspace._id };
}
