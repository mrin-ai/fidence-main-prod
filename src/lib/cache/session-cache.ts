import { ObjectId } from "mongodb";

import { cacheDel, cacheGet, cacheSet } from "@/lib/cache/redis";
import type {
  SessionContext,
  SessionDoc,
  UserDoc,
  WorkspaceDoc,
} from "@/lib/db/types";

const SESSION_KEY_PREFIX = "session:";

type SerializedSessionContext = {
  session: Omit<SessionDoc, "_id" | "userId" | "workspaceId" | "expiresAt" | "createdAt"> & {
    _id: string;
    userId: string;
    workspaceId: string;
    expiresAt: string;
    createdAt: string;
  };
  user: Omit<UserDoc, "_id" | "lastLoginAt" | "createdAt" | "updatedAt"> & {
    _id: string;
    lastLoginAt: string;
    createdAt: string;
    updatedAt: string;
  };
  workspace: Omit<WorkspaceDoc, "_id" | "ownerId" | "createdAt" | "updatedAt"> & {
    _id: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  };
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

function serializeSessionContext(context: SessionContext): SerializedSessionContext {
  return {
    session: {
      ...context.session,
      _id: context.session._id.toString(),
      userId: context.session.userId.toString(),
      workspaceId: context.session.workspaceId.toString(),
      expiresAt: context.session.expiresAt.toISOString(),
      createdAt: context.session.createdAt.toISOString(),
    },
    user: {
      ...context.user,
      _id: context.user._id.toString(),
      lastLoginAt: context.user.lastLoginAt.toISOString(),
      createdAt: context.user.createdAt.toISOString(),
      updatedAt: context.user.updatedAt.toISOString(),
    },
    workspace: {
      ...context.workspace,
      _id: context.workspace._id.toString(),
      ownerId: context.workspace.ownerId.toString(),
      createdAt: context.workspace.createdAt.toISOString(),
      updatedAt: context.workspace.updatedAt.toISOString(),
    },
  };
}

function deserializeSessionContext(payload: SerializedSessionContext): SessionContext {
  return {
    session: {
      ...payload.session,
      _id: new ObjectId(payload.session._id),
      userId: new ObjectId(payload.session.userId),
      workspaceId: new ObjectId(payload.session.workspaceId),
      expiresAt: new Date(payload.session.expiresAt),
      createdAt: new Date(payload.session.createdAt),
    },
    user: {
      ...payload.user,
      _id: new ObjectId(payload.user._id),
      lastLoginAt: new Date(payload.user.lastLoginAt),
      createdAt: new Date(payload.user.createdAt),
      updatedAt: new Date(payload.user.updatedAt),
    },
    workspace: {
      ...payload.workspace,
      _id: new ObjectId(payload.workspace._id),
      ownerId: new ObjectId(payload.workspace.ownerId),
      createdAt: new Date(payload.workspace.createdAt),
      updatedAt: new Date(payload.workspace.updatedAt),
    },
  };
}

export async function getCachedSession(token: string) {
  if (!isSessionCacheEnabled()) return null;

  const raw = await cacheGet(sessionKey(token));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SerializedSessionContext;
    const context = deserializeSessionContext(parsed);
    if (context.session.expiresAt <= new Date()) {
      await invalidateSession(token);
      return null;
    }
    return context;
  } catch {
    await invalidateSession(token);
    return null;
  }
}

export async function hasCachedSession(token: string) {
  return Boolean(await getCachedSession(token));
}

export async function setCachedSession(token: string, context: SessionContext) {
  if (!isSessionCacheEnabled()) return;

  const ttl = ttlSecondsUntil(context.session.expiresAt);
  await cacheSet(
    sessionKey(token),
    JSON.stringify(serializeSessionContext(context)),
    ttl,
  );
}

export async function invalidateSession(token: string) {
  await cacheDel(sessionKey(token));
}
