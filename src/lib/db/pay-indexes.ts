import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";

const META_KEY = "pay_indexes_v1";

type DbMetaDoc = {
  _id: string;
  completedAt: Date;
};

let indexesPromise: Promise<void> | null = null;

export async function ensurePayIndexes() {
  if (!indexesPromise) {
    indexesPromise = ensurePayIndexesInner().catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }
  return indexesPromise;
}

async function ensurePayIndexesInner() {
  const db = await getDb();
  const meta = db.collection<DbMetaDoc>(COLLECTIONS.dbMeta);
  const existing = await meta.findOne({ _id: META_KEY });
  if (existing) return;

  await Promise.all([
    db
      .collection(COLLECTIONS.agentLinkSessions)
      .createIndex({ linkId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.agentLinkSessions).createIndex({
      expiresAt: 1,
      status: 1,
    }),
    db.collection(COLLECTIONS.agentLinkSessions).createIndex({
      workspaceId: 1,
      status: 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.savedAddresses).createIndex({
      workspaceId: 1,
      createdAt: -1,
    }),
    db
      .collection(COLLECTIONS.paymentIntents)
      .createIndex({ intentId: 1 }, { unique: true }),
    db.collection(COLLECTIONS.paymentIntents).createIndex({
      workspaceId: 1,
      status: 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.paymentIntents).createIndex({
      workspaceId: 1,
      agentObjectId: 1,
      status: 1,
    }),
    db.collection(COLLECTIONS.agents).createIndex({
      workspaceId: 1,
      registrationSource: 1,
      lastActiveAt: -1,
    }),
  ]);

  await meta.insertOne({
    _id: META_KEY,
    completedAt: new Date(),
  });
}
