import type { ObjectId } from "mongodb";

import { getTxExplorerUrl } from "@/lib/block-explorer";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { TransactionDoc } from "@/lib/db/types";
import { formatPaymentDateTime } from "@/lib/format-date";

export const TRANSACTIONS_PAGE_LIMIT = 20;

export type TransactionListItem = {
  id: string;
  label: string;
  amount: string;
  direction: "in" | "out";
  date: string;
  txHash?: string;
  explorerUrl?: string;
};

function formatTokenAmount(amount: number, symbol: string) {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${symbol.toUpperCase()}`;
}

function isOutgoingTransaction(type: TransactionDoc["type"]) {
  return type === "payment_sent" || type === "payout" || type === "refund";
}

function mapTransactionDoc(tx: TransactionDoc): TransactionListItem {
  const outgoing = isOutgoingTransaction(tx.type);
  const explorerUrl =
    tx.txHash && tx.networkId
      ? getTxExplorerUrl(tx.networkId, tx.txHash) ?? undefined
      : undefined;

  return {
    id: tx._id.toString(),
    label: tx.label,
    amount: `${outgoing ? "-" : "+"}${formatTokenAmount(tx.amount, tx.symbol)}`,
    direction: outgoing ? "out" : "in",
    date: formatPaymentDateTime(tx.occurredAt),
    txHash: tx.txHash,
    explorerUrl,
  };
}

export async function listWorkspaceTransactions(
  workspaceId: ObjectId,
  options: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(
    100,
    Math.max(1, options.limit ?? TRANSACTIONS_PAGE_LIMIT),
  );
  const skip = (page - 1) * limit;
  const db = await getDb();

  const filter = { workspaceId, status: "confirmed" as const };

  const [transactions, total] = await Promise.all([
    db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.transactions).countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items: transactions.map(mapTransactionDoc),
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}
