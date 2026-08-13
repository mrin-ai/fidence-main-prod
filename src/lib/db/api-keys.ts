import { createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type {
  ApiKeyDoc,
  ApiKeyEnvironment,
  ApiKeyType,
  SecurityContext,
} from "@/lib/db/merchant-types";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { ApiKeyOverview } from "@/lib/merchant-ui-types";

export const API_KEY_PREFIXES = {
  live: "fid_live_",
  test: "fid_test_",
  admin: "fid_admin_",
  agent: "fid_agent_",
} as const;

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function detectKeyMeta(rawKey: string): {
  prefix: string;
  keyType: ApiKeyType;
  environment: ApiKeyEnvironment;
} | null {
  if (rawKey.startsWith(API_KEY_PREFIXES.live)) {
    return { prefix: API_KEY_PREFIXES.live, keyType: "workspace", environment: "live" };
  }
  if (rawKey.startsWith(API_KEY_PREFIXES.test)) {
    return { prefix: API_KEY_PREFIXES.test, keyType: "workspace", environment: "test" };
  }
  if (rawKey.startsWith(API_KEY_PREFIXES.admin)) {
    return { prefix: API_KEY_PREFIXES.admin, keyType: "admin", environment: "live" };
  }
  if (rawKey.startsWith(API_KEY_PREFIXES.agent)) {
    return { prefix: API_KEY_PREFIXES.agent, keyType: "agent", environment: "live" };
  }
  return null;
}

function generateRawApiKey(environment: ApiKeyEnvironment = "live") {
  const prefix =
    environment === "test" ? API_KEY_PREFIXES.test : API_KEY_PREFIXES.live;
  return `${prefix}${randomBytes(24).toString("hex")}`;
}

export async function getApiKeyOverview(
  workspaceId: ObjectId,
): Promise<ApiKeyOverview> {
  const db = await getDb();
  const doc = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).findOne({
    workspaceId,
    $or: [
      { keyType: "workspace", environment: "live" },
      { keyType: { $exists: false } },
    ],
  });

  if (!doc) {
    return {
      hasKey: false,
      maskedKey: null,
      keyLast4: null,
      createdAt: null,
      lastUsedAt: null,
    };
  }

  return {
    hasKey: true,
    maskedKey: `${doc.keyPrefix}••••••••${doc.keyLast4}`,
    keyLast4: doc.keyLast4,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
  };
}

export async function getTestApiKeyOverview(workspaceId: ObjectId) {
  const db = await getDb();
  const doc = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).findOne({
    workspaceId,
    keyType: "workspace",
    environment: "test",
  });

  if (!doc) {
    return {
      hasKey: false,
      maskedKey: null,
      keyLast4: null,
      createdAt: null,
      lastUsedAt: null,
    };
  }

  return {
    hasKey: true,
    maskedKey: `${doc.keyPrefix}••••••••${doc.keyLast4}`,
    keyLast4: doc.keyLast4,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
  };
}

async function upsertWorkspaceApiKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
  environment: ApiKeyEnvironment;
}) {
  const db = await getDb();
  const now = new Date();
  const rawKey = generateRawApiKey(input.environment);
  const keyHash = hashApiKey(rawKey);
  const keyLast4 = rawKey.slice(-4);
  const prefix =
    input.environment === "test" ? API_KEY_PREFIXES.test : API_KEY_PREFIXES.live;

  await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).updateOne(
    {
      workspaceId: input.workspaceId,
      keyType: "workspace",
      environment: input.environment,
    },
    {
      $set: {
        createdBy: input.userId,
        keyHash,
        keyPrefix: prefix,
        keyLast4,
        keyType: "workspace",
        environment: input.environment,
        permissions: ["*"],
        updatedAt: now,
      },
      $setOnInsert: {
        workspaceId: input.workspaceId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.userId.toString(),
    action:
      input.environment === "test" ? "api_test_key_rotated" : "api_key_rotated",
    resourceType: "api_key",
    security: input.security,
  });

  return {
    apiKey: rawKey,
    maskedKey: `${prefix}••••••••${keyLast4}`,
    keyLast4,
    createdAt: now.toISOString(),
    environment: input.environment,
  };
}

export async function createOrRotateApiKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  return upsertWorkspaceApiKey({
    ...input,
    environment: "live",
  });
}

export async function createOrRotateTestApiKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  return upsertWorkspaceApiKey({
    ...input,
    environment: "test",
  });
}

export async function createOrRotateAdminApiKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
  name?: string;
}) {
  const db = await getDb();
  const now = new Date();
  const rawKey = `${API_KEY_PREFIXES.admin}${randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const keyLast4 = rawKey.slice(-4);

  await db.collection(COLLECTIONS.apiKeys).insertOne({
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    createdBy: input.userId,
    keyHash,
    keyPrefix: API_KEY_PREFIXES.admin,
    keyLast4,
    keyType: "admin",
    environment: "live",
    permissions: ["compliance.approvals.approve", "compliance.approvals.read"],
    name: input.name ?? "Admin approval key",
    createdAt: now,
    updatedAt: now,
  });

  return {
    apiKey: rawKey,
    maskedKey: `${API_KEY_PREFIXES.admin}••••••••${keyLast4}`,
    keyLast4,
    createdAt: now.toISOString(),
  };
}

export async function issueAgentScopedKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  agentId: ObjectId;
  agentName: string;
  security: SecurityContext;
  plaintextKeyStorage?: boolean;
}) {
  const db = await getDb();
  const now = new Date();
  const rawKey = `${API_KEY_PREFIXES.agent}${randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const keyLast4 = rawKey.slice(-4);
  const apiKeyId = new ObjectId();

  const { AGENT_SCOPED_KEY_PERMISSIONS } = await import("@/lib/pay/config");

  const doc: ApiKeyDoc & { plaintextKey?: string } = {
    _id: apiKeyId,
    workspaceId: input.workspaceId,
    createdBy: input.userId,
    keyHash,
    keyPrefix: API_KEY_PREFIXES.agent,
    keyLast4,
    keyType: "agent",
    environment: "live",
    permissions: [...AGENT_SCOPED_KEY_PERMISSIONS],
    agentId: input.agentId,
    name: `${input.agentName} (linked agent)`,
    createdAt: now,
    updatedAt: now,
  };

  if (input.plaintextKeyStorage) {
    doc.plaintextKey = rawKey;
  }

  await db.collection(COLLECTIONS.apiKeys).insertOne(doc);

  await logSecurityEvent({
    workspaceId: input.workspaceId,
    actorType: "user",
    actorId: input.userId.toString(),
    agentId: input.agentId,
    action: "agent_scoped_key_issued",
    resourceType: "api_key",
    resourceId: apiKeyId.toString(),
    security: input.security,
  });

  return {
    apiKeyId,
    apiKey: rawKey,
    maskedKey: `${API_KEY_PREFIXES.agent}••••••••${keyLast4}`,
    keyLast4,
    createdAt: now.toISOString(),
  };
}

export async function revokeAgentScopedKeysForAgent(input: {
  workspaceId: ObjectId;
  agentId: ObjectId;
  security: SecurityContext;
  actorUserId: string;
}) {
  const db = await getDb();
  const now = new Date();

  const result = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).updateMany(
    {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      keyType: "agent",
      revokedAt: { $exists: false },
    },
    {
      $set: {
        revokedAt: now,
        updatedAt: now,
      },
      $unset: { plaintextKey: "" },
    },
  );

  if (result.modifiedCount > 0) {
    await logSecurityEvent({
      workspaceId: input.workspaceId,
      actorType: "user",
      actorId: input.actorUserId,
      agentId: input.agentId,
      action: "agent_scoped_keys_revoked",
      resourceType: "agent",
      resourceId: input.agentId.toString(),
      security: input.security,
    });
  }

  return result.modifiedCount;
}

export async function resolveApiKey(rawKey: string) {
  const meta = detectKeyMeta(rawKey);
  if (!meta) return null;

  const db = await getDb();
  const keyHash = hashApiKey(rawKey);
  const doc = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).findOne({
    keyHash,
    revokedAt: { $exists: false },
  });

  if (!doc) return null;

  const now = new Date();
  await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).updateOne(
    { _id: doc._id },
    { $set: { lastUsedAt: now } },
  );

  return {
    ...doc,
    keyType: doc.keyType ?? meta.keyType,
    environment: doc.environment ?? meta.environment,
    permissions: doc.permissions ?? (meta.keyType === "admin" ? [] : ["*"]),
    lastUsedAt: now,
  };
}

export function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export function apiKeyHasPermission(
  doc: ApiKeyDoc,
  permission: string,
): boolean {
  const permissions = doc.permissions ?? ["*"];
  return permissions.includes("*") || permissions.includes(permission);
}
