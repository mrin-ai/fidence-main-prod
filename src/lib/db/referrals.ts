import { randomBytes } from "crypto";
import type { ObjectId } from "mongodb";

import { getPaymentBaseUrl } from "@/lib/payment-link-url";
import { buildReferralSignupUrl, normalizeReferralCode } from "@/lib/referrals";
import { truncateAddress } from "@/lib/profile-url";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/types";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ReferralListItem = {
  id: string;
  name: string;
  initials: string;
  signUpMethod: "wallet" | "google";
  identity: string;
  identityLabel: string;
  username: string | null;
  joinedAt: string;
  joinedAtLabel: string;
};

export type ReferralOverview = {
  referralCode: string;
  referralUrl: string;
  totalReferrals: number;
  lcxRewards: number;
  referredBy: {
    name: string;
    username: string | null;
    referralCode: string;
  } | null;
  referrals: ReferralListItem[];
};

function generateReferralCodeCandidate() {
  const bytes = randomBytes(8);
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += REFERRAL_ALPHABET[bytes[index]! % REFERRAL_ALPHABET.length];
  }

  return code;
}

export async function generateUniqueReferralCode() {
  const db = await getDb();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const referralCode = generateReferralCodeCandidate();
    const existing = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
      referralCode,
    });

    if (!existing) {
      return referralCode;
    }
  }

  throw new Error("Failed to generate unique referral code");
}

export async function ensureUserReferralCode(userId: ObjectId) {
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.referralCode) {
    return user.referralCode;
  }

  const referralCode = await generateUniqueReferralCode();
  const now = new Date();

  await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId },
    { $set: { referralCode, updatedAt: now } },
  );

  return referralCode;
}

export async function resolveReferrerByCode(
  referralCode: string | undefined,
  options?: { excludeUserId?: ObjectId; excludeWalletAddress?: string },
) {
  if (!referralCode?.trim()) return null;

  const normalized = normalizeReferralCode(referralCode);
  const db = await getDb();

  const referrer = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    referralCode: normalized,
  });

  if (!referrer) return null;
  if (options?.excludeUserId && referrer._id.equals(options.excludeUserId)) {
    return null;
  }

  if (options?.excludeWalletAddress) {
    const wallet = options.excludeWalletAddress.toLowerCase();
    if (referrer.walletAddresses.some((entry) => entry.toLowerCase() === wallet)) {
      return null;
    }
  }

  return referrer;
}

function formatJoinedDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPrimaryWalletAddress(user: UserDoc) {
  return user.walletAddresses[0] ?? null;
}

function getSignUpMethod(user: UserDoc): "wallet" | "google" {
  const hasWallet = user.authProviders.some((provider) => provider.type === "wallet");
  return hasWallet ? "wallet" : "google";
}

function toReferralListItem(user: UserDoc): ReferralListItem {
  const signUpMethod = getSignUpMethod(user);
  const walletAddress = getPrimaryWalletAddress(user);

  const identity =
    signUpMethod === "wallet" && walletAddress
      ? truncateAddress(walletAddress, 4)
      : user.email ?? user.name;

  return {
    id: user._id.toString(),
    name: user.name,
    initials: user.initials,
    signUpMethod,
    identity,
    identityLabel: signUpMethod === "wallet" ? "Wallet" : "Email",
    username: user.username ?? null,
    joinedAt: user.createdAt.toISOString(),
    joinedAtLabel: formatJoinedDate(user.referredAt ?? user.createdAt),
  };
}

export async function getReferralOverview(userId: ObjectId): Promise<ReferralOverview> {
  const db = await getDb();
  const referralCode = await ensureUserReferralCode(userId);

  const [user, referrals, referrer] = await Promise.all([
    db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: userId }),
    db
      .collection<UserDoc>(COLLECTIONS.users)
      .find({ referredByUserId: userId })
      .sort({ referredAt: -1, createdAt: -1 })
      .toArray(),
    db.collection<UserDoc>(COLLECTIONS.users).findOne({ _id: userId }).then(async (current) => {
      if (!current?.referredByUserId) return null;
      return db.collection<UserDoc>(COLLECTIONS.users).findOne({
        _id: current.referredByUserId,
      });
    }),
  ]);

  const totalReferrals = referrals.length;
  const creditsPerReferral = 5;

  return {
    referralCode,
    referralUrl: buildReferralSignupUrl(referralCode),
    totalReferrals,
    lcxRewards: totalReferrals * creditsPerReferral,
    referredBy: referrer
      ? {
          name: referrer.name,
          username: referrer.username ?? null,
          referralCode: referrer.referralCode ?? "",
        }
      : null,
    referrals: referrals.map(toReferralListItem),
  };
}

export function getReferralSignupPath(referralCode: string) {
  return `/sign-up?ref=${encodeURIComponent(normalizeReferralCode(referralCode))}`;
}

export function getAppBaseUrl() {
  return getPaymentBaseUrl();
}
