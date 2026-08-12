import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { normalizeTxHash } from "@/lib/payment/normalize";
import type { TransactionDoc } from "@/lib/db/types";

export async function findTransactionByWorkspaceTxHash(
  workspaceId: ObjectId,
  txHash: string,
  networkId?: string,
) {
  const db = await getDb();
  const normalized = networkId
    ? normalizeTxHash(txHash, networkId)
    : txHash.trim();
  return db.collection<TransactionDoc>(COLLECTIONS.transactions).findOne({
    workspaceId,
    txHash: normalized,
  });
}
