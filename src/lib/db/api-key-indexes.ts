import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";

/** Ensures api_keys indexes allow multiple linked agents per workspace. */
export async function ensureApiKeyIndexes() {
  const db = await getDb();
  const collection = db.collection(COLLECTIONS.apiKeys);

  try {
    await collection.dropIndex("workspaceId_1_keyType_1_environment_1");
  } catch {
    // Legacy index may already be removed.
  }

  await collection.createIndex(
    { workspaceId: 1, keyType: 1, environment: 1 },
    {
      unique: true,
      name: "workspace_api_key_unique",
      partialFilterExpression: { keyType: "workspace" },
    },
  );

  await collection.createIndex(
    { workspaceId: 1, agentId: 1, keyType: 1, environment: 1 },
    {
      unique: true,
      name: "active_agent_api_key_unique",
      partialFilterExpression: {
        keyType: "agent",
        agentId: { $exists: true },
        revokedAt: null,
      },
    },
  );

  await collection.updateMany(
    {
      keyPrefix: { $in: ["fid_live_", "fid_test_"] },
      keyType: { $exists: false },
    },
    {
      $set: {
        keyType: "workspace",
        environment: "live",
      },
    },
  );
}
