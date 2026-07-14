import { createHash, randomBytes } from "crypto";
import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ApiKeyDoc } from "@/lib/db/merchant-types";
import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityContext } from "@/lib/db/merchant-types";

const API_KEY_PREFIX = "fid_live_";

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function generateRawApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

import type { ApiKeyOverview } from "@/lib/merchant-ui-types";

export async function getApiKeyOverview(
  workspaceId: ObjectId,
): Promise<ApiKeyOverview> {
  const db = await getDb();
  const doc = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).findOne({
    workspaceId,
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

export async function createOrRotateApiKey(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  security: SecurityContext;
}) {
  const db = await getDb();
  const now = new Date();
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyLast4 = rawKey.slice(-4);

  await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).updateOne(
    { workspaceId: input.workspaceId },
    {
      $set: {
        createdBy: input.userId,
        keyHash,
        keyPrefix: API_KEY_PREFIX,
        keyLast4,
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
    action: "api_key_rotated",
    resourceType: "api_key",
    security: input.security,
  });

  return {
    apiKey: rawKey,
    maskedKey: `${API_KEY_PREFIX}••••••••${keyLast4}`,
    keyLast4,
    createdAt: now.toISOString(),
  };
}

export async function resolveApiKey(rawKey: string) {
  if (!rawKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const db = await getDb();
  const keyHash = hashApiKey(rawKey);
  const doc = await db.collection<ApiKeyDoc>(COLLECTIONS.apiKeys).findOne({
    keyHash,
  });

  if (!doc) return null;

  return doc;
}

export function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
