import { ObjectId } from "mongodb";

import { cacheDel, cacheGet, cacheSet, parseStoredJson } from "@/lib/cache/redis";
import {
  CACHE_TTL,
  merchantContextCacheKey,
} from "@/lib/cache/keys";
import type { UserDoc, WorkspaceDoc } from "@/lib/db/types";

export type CachedMerchantContext = {
  workspace: WorkspaceDoc;
  owner: UserDoc;
};

type SerializedMerchantContext = {
  workspace: Record<string, unknown>;
  owner: Record<string, unknown>;
};

function serializeDoc(doc: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(doc, (_key, value) => {
      if (value instanceof ObjectId) return value.toString();
      if (value instanceof Date) return value.toISOString();
      return value;
    }),
  ) as Record<string, unknown>;
}

function hydrateObjectId(value: unknown) {
  if (typeof value === "string") return new ObjectId(value);
  return new ObjectId(String(value));
}

function hydrateDate(value: unknown) {
  return new Date(String(value));
}

function hydrateWorkspace(raw: Record<string, unknown>): WorkspaceDoc {
  return {
    ...raw,
    _id: hydrateObjectId(raw._id),
    ownerId: hydrateObjectId(raw.ownerId),
    createdAt: hydrateDate(raw.createdAt),
    updatedAt: hydrateDate(raw.updatedAt),
  } as WorkspaceDoc;
}

function hydrateUser(raw: Record<string, unknown>): UserDoc {
  return {
    ...raw,
    _id: hydrateObjectId(raw._id),
    ...(raw.referredByUserId
      ? { referredByUserId: hydrateObjectId(raw.referredByUserId) }
      : {}),
    ...(raw.referredAt ? { referredAt: hydrateDate(raw.referredAt) } : {}),
    lastLoginAt: hydrateDate(raw.lastLoginAt),
    createdAt: hydrateDate(raw.createdAt),
    updatedAt: hydrateDate(raw.updatedAt),
  } as UserDoc;
}

export async function getCachedMerchantContext(keyHash: string) {
  const raw = await cacheGet(merchantContextCacheKey(keyHash));
  const parsed = parseStoredJson<SerializedMerchantContext>(raw);
  if (!parsed?.workspace || !parsed.owner) return null;

  try {
    return {
      workspace: hydrateWorkspace(parsed.workspace),
      owner: hydrateUser(parsed.owner),
    };
  } catch {
    await cacheDel(merchantContextCacheKey(keyHash));
    return null;
  }
}

export async function setCachedMerchantContext(
  keyHash: string,
  context: CachedMerchantContext,
) {
  const payload: SerializedMerchantContext = {
    workspace: serializeDoc(
      context.workspace as unknown as Record<string, unknown>,
    ),
    owner: serializeDoc(context.owner as unknown as Record<string, unknown>),
  };

  await cacheSet(
    merchantContextCacheKey(keyHash),
    JSON.stringify(payload),
    CACHE_TTL.merchantContextSeconds,
  );
}

export async function invalidateMerchantContextCache(keyHash: string) {
  await cacheDel(merchantContextCacheKey(keyHash));
}
