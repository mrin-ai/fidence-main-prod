import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";

const META_KEY = "compliance_indexes_v1";

type DbMetaDoc = {
  _id: string;
  completedAt: Date;
};

let indexesPromise: Promise<void> | null = null;

export async function ensureComplianceIndexes() {
  if (!indexesPromise) {
    indexesPromise = ensureComplianceIndexesInner().catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }
  return indexesPromise;
}

async function ensureComplianceIndexesInner() {
  const db = await getDb();
  const meta = db.collection<DbMetaDoc>(COLLECTIONS.dbMeta);
  const existing = await meta.findOne({ _id: META_KEY });
  if (existing) return;

  await Promise.all([
    db.collection(COLLECTIONS.agentPolicies).createIndex(
      { workspaceId: 1, agentId: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.policyDecisions).createIndex(
      { receiptId: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.policyDecisions).createIndex({
      workspaceId: 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.policyDecisions).createIndex({
      workspaceId: 1,
      agentId: 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.policyDecisions).createIndex({
      workspaceId: 1,
      "actor.ip": 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.policyDecisions).createIndex({
      workspaceId: 1,
      "actor.actorType": 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.agentSpendDaily).createIndex(
      { workspaceId: 1, agentId: 1, day: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.agentSpendMonthly).createIndex(
      { workspaceId: 1, agentId: 1, month: 1 },
      { unique: true },
    ),
    db.collection(COLLECTIONS.paymentApprovals).createIndex({
      workspaceId: 1,
      status: 1,
      createdAt: -1,
    }),
    db.collection(COLLECTIONS.paymentApprovals).createIndex(
      { approvalId: 1 },
      { unique: true },
    ),
  ]);

  await meta.insertOne({
    _id: META_KEY,
    completedAt: new Date(),
  });
}
