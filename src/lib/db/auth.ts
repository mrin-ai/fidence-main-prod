import { cookies } from "next/headers";
import { cache } from "react";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, getInitials, slugify } from "@/lib/auth-session";
import {
  getCachedSession,
  invalidateSession,
  setCachedSession,
} from "@/lib/cache/session-cache";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  generateUniqueReferralCode,
  resolveReferrerByCode,
} from "@/lib/db/referrals";
import type {
  SessionContext,
  SessionDoc,
  UserDoc,
  WorkspaceDoc,
} from "@/lib/db/types";

const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

export function sessionCookieOptions(token: string) {
  return {
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

async function createDefaultWorkspace(user: UserDoc) {
  const db = await getDb();
  const now = new Date();
  const slugBase = slugify(user.name) || "workspace";
  let slug = slugBase;
  let suffix = 1;

  while (await db.collection(COLLECTIONS.workspaces).findOne({ slug })) {
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const workspaceInsert = await db.collection(COLLECTIONS.workspaces).insertOne({
    name: `${user.name.split(" ")[0] ?? "My"} Workspace`,
    slug,
    ownerId: user._id,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });

  const workspaceId = workspaceInsert.insertedId;

  await db.collection(COLLECTIONS.workspaceMembers).insertOne({
    workspaceId,
    userId: user._id,
    role: "owner",
    joinedAt: now,
  });

  return db.collection<WorkspaceDoc>(COLLECTIONS.workspaces).findOne({
    _id: workspaceId,
  });
}

export async function getWorkspaceForUser(userId: ObjectId) {
  const db = await getDb();
  const membership = await db
    .collection(COLLECTIONS.workspaceMembers)
    .findOne({ userId });

  if (!membership) return null;

  return db.collection<WorkspaceDoc>(COLLECTIONS.workspaces).findOne({
    _id: membership.workspaceId,
  });
}

export async function createSessionForUser(
  user: UserDoc,
  authMethod: "google" | "wallet",
  walletAddress?: string,
) {
  const db = await getDb();
  const now = new Date();

  let workspace = await getWorkspaceForUser(user._id);
  if (!workspace) {
    workspace = await createDefaultWorkspace(user);
  }

  if (!workspace) {
    throw new Error("Failed to resolve workspace for user");
  }

  const token = randomUUID();
  const sessionId = new ObjectId();
  const session: Omit<SessionDoc, "_id"> = {
    token,
    userId: user._id,
    workspaceId: workspace._id,
    authMethod,
    walletAddress: walletAddress?.toLowerCase(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    createdAt: now,
  };

  const sessionDoc: SessionDoc = {
    _id: sessionId,
    ...session,
  };

  await db.collection<SessionDoc>(COLLECTIONS.sessions).insertOne(sessionDoc);

  await db.collection(COLLECTIONS.users).updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: now, updatedAt: now } },
  );

  await setCachedSession(token, {
    session: sessionDoc,
    user,
    workspace,
  });

  return { token, user, workspace };
}

export async function upsertGoogleUser(input: {
  email: string;
  name: string;
  referralCode?: string;
}) {
  const db = await getDb();
  const now = new Date();
  const existing = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    email: input.email,
  });

  if (existing) {
    await db.collection(COLLECTIONS.users).updateOne(
      { _id: existing._id },
      {
        $set: {
          name: input.name,
          initials: getInitials(input.name),
          lastLoginAt: now,
          updatedAt: now,
        },
        $addToSet: {
          authProviders: {
            type: "google",
            providerId: input.email,
            email: input.email,
          },
        },
      },
    );

    return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: existing._id });
  }

  const referralCode = await generateUniqueReferralCode();
  const referrer = await resolveReferrerByCode(input.referralCode);

  const insert = await db.collection(COLLECTIONS.users).insertOne({
    email: input.email,
    name: input.name,
    initials: getInitials(input.name),
    role: "owner",
    authProviders: [
      { type: "google", providerId: input.email, email: input.email },
    ],
    walletAddresses: [],
    verifiedWallets: [],
    referralCode,
    ...(referrer
      ? { referredByUserId: referrer._id, referredAt: now }
      : {}),
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: insert.insertedId });
}

export async function upsertWalletUser(
  address: string,
  referralCode?: string,
) {
  const db = await getDb();
  const now = new Date();
  const normalized = address.toLowerCase();
  const shortName = `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;

  const existing = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    walletAddresses: normalized,
  });

  if (existing) {
    await db.collection(COLLECTIONS.users).updateOne(
      { _id: existing._id },
      {
        $set: { lastLoginAt: now, updatedAt: now },
        $addToSet: {
          authProviders: { type: "wallet", providerId: normalized },
          walletAddresses: normalized,
        },
      },
    );

    return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: existing._id });
  }

  const ownReferralCode = await generateUniqueReferralCode();
  const referrer = await resolveReferrerByCode(referralCode, {
    excludeWalletAddress: normalized,
  });

  const insert = await db.collection(COLLECTIONS.users).insertOne({
    name: shortName,
    initials: normalized.slice(2, 4).toUpperCase(),
    role: "owner",
    authProviders: [{ type: "wallet", providerId: normalized }],
    walletAddresses: [normalized],
    verifiedWallets: [],
    referralCode: ownReferralCode,
    ...(referrer
      ? { referredByUserId: referrer._id, referredAt: now }
      : {}),
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: insert.insertedId });
}

export async function getSessionByToken(token: string) {
  let cached: SessionContext | null = null;
  try {
    cached = await getCachedSession(token);
  } catch (error) {
    console.error("Session cache lookup failed:", error);
  }

  if (cached) {
    return cached;
  }

  const db = await getDb();
  const session = await db.collection<SessionDoc>(COLLECTIONS.sessions).findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const [user, workspace] = await Promise.all([
    db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: session.userId }),
    db.collection<WorkspaceDoc>(COLLECTIONS.workspaces).findOne({
      _id: session.workspaceId,
    }),
  ]);

  if (!user || !workspace) return null;

  const context = { session, user, workspace } satisfies SessionContext;
  await setCachedSession(token, context);
  return context;
}

export const getSessionFromCookies = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return getSessionByToken(token);
});

export async function refreshSessionFromDatabase(token: string) {
  await invalidateSession(token);
  return getSessionByToken(token);
}

export async function deleteSessionByToken(token: string) {
  const db = await getDb();
  await db.collection(COLLECTIONS.sessions).deleteOne({ token });
  await invalidateSession(token);
}
