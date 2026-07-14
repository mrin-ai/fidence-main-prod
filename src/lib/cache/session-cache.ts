import { ObjectId } from "mongodb";

import { cacheDel, cacheGet, cacheSet, parseStoredJson } from "@/lib/cache/redis";
import type { SessionDoc } from "@/lib/db/types";

const SESSION_KEY_PREFIX = "session:";

type SerializedSessionDoc = Omit<
  SessionDoc,
  "_id" | "userId" | "workspaceId" | "expiresAt" | "createdAt"
> & {
  _id: string;
  userId: string;
  workspaceId: string;
  expiresAt: string;
  createdAt: string;
};

type LegacySerializedSessionContext = {
  session: SerializedSessionDoc;
};

function isSessionCacheEnabled() {
  return process.env.SESSION_CACHE_ENABLED !== "false";
}

function sessionKey(token: string) {
  return `${SESSION_KEY_PREFIX}${token}`;
}

function ttlSecondsUntil(expiresAt: Date) {
  const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(seconds, 60 * 60 * 24 * 7));
}

function serializeSessionDoc(session: SessionDoc): SerializedSessionDoc {
  return {
    ...session,
    _id: session._id.toString(),
    userId: session.userId.toString(),
    workspaceId: session.workspaceId.toString(),
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

function deserializeSessionDoc(payload: SerializedSessionDoc): SessionDoc {
  return {
    ...payload,
    _id: new ObjectId(payload._id),
    userId: new ObjectId(payload.userId),
    workspaceId: new ObjectId(payload.workspaceId),
    expiresAt: new Date(payload.expiresAt),
    createdAt: new Date(payload.createdAt),
  };
}

function parseCachedSessionPayload(raw: unknown): SessionDoc | null {
  const parsed = parseStoredJson<SerializedSessionDoc | LegacySerializedSessionContext>(
    raw,
  );
  if (!parsed) return null;

  if ("session" in parsed && parsed.session) {
    return deserializeSessionDoc(parsed.session);
  }

  if ("token" in parsed && "userId" in parsed && "workspaceId" in parsed) {
    return deserializeSessionDoc(parsed as SerializedSessionDoc);
  }

  return null;
}

export async function getCachedSessionDoc(token: string) {
  if (!isSessionCacheEnabled()) return null;

  try {
    const raw = await cacheGet(sessionKey(token));
    if (!raw) return null;

    const session = parseCachedSessionPayload(raw);
    if (!session) {
      await invalidateSession(token);
      return null;
    }

    if (session.expiresAt <= new Date()) {
      await invalidateSession(token);
      return null;
    }

    return session;
  } catch (error) {
    console.error("Session cache read failed:", error);
    try {
      await invalidateSession(token);
    } catch {
      // Ignore cache invalidation failures.
    }
    return null;
  }
}

export async function hasCachedSession(token: string) {
  return Boolean(await getCachedSessionDoc(token));
}

export async function setCachedSessionDoc(token: string, session: SessionDoc) {
  if (!isSessionCacheEnabled()) return;

  try {
    const ttl = ttlSecondsUntil(session.expiresAt);
    await cacheSet(
      sessionKey(token),
      JSON.stringify(serializeSessionDoc(session)),
      ttl,
    );
  } catch (error) {
    console.error("Session cache write failed:", error);
  }
}

export async function invalidateSession(token: string) {
  await cacheDel(sessionKey(token));
}
