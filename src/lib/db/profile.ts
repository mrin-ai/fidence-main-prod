import { ObjectId } from "mongodb";
import { getInitials } from "@/lib/auth-session";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { syncPaymentLinksForUserUsername } from "@/lib/db/payment-links";
import type { UserDoc, UserProfile } from "@/lib/db/types";

const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "dashboard",
  "help",
  "invoice",
  "invoices",
  "login",
  "manage-invoices",
  "activity",
  "payment-links",
  "settings",
  "sign-in",
  "sign-up",
  "support",
  "wallet",
  "wallets",
  "www",
]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9_]{3,30}$/.test(value);
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (!username) {
    return { ok: false as const, error: "Username is required" };
  }

  if (!isValidUsername(username)) {
    return {
      ok: false as const,
      error: "Use 3–30 characters: lowercase letters, numbers, and underscores only",
    };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false as const, error: "This username is not available" };
  }

  return { ok: true as const, username };
}

export async function updateUserPersonalInfo(
  userId: ObjectId,
  input: UserProfile,
) {
  const db = await getDb();
  const now = new Date();

  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const company = input.company?.trim() ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  const update: Partial<UserDoc> = {
    profile: {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone: phone || undefined,
      company: company || undefined,
    },
    updatedAt: now,
  };

  if (name) {
    update.name = name;
    update.initials = getInitials(name);
  }

  await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId },
    { $set: update },
  );

  return db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: userId });
}

export async function updateUsername(userId: ObjectId, rawUsername: string) {
  const validation = validateUsername(rawUsername);
  if (!validation.ok) {
    return { ok: false as const, error: validation.error };
  }

  const db = await getDb();
  const now = new Date();
  const existing = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username: validation.username,
    _id: { $ne: userId },
  });

  if (existing) {
    return { ok: false as const, error: "This username is already taken" };
  }

  const currentUser = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });

  if (currentUser?.username === validation.username) {
    return { ok: true as const, user: currentUser };
  }

  await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId },
    {
      $set: {
        username: validation.username,
        updatedAt: now,
      },
    },
  );

  await syncPaymentLinksForUserUsername(userId, validation.username);

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });

  return { ok: true as const, user };
}
