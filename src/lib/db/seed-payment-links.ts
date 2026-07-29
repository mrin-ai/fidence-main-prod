import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { createPaymentLink } from "@/lib/db/payment-links";
import type { SessionDoc, UserDoc } from "@/lib/db/types";

const DEFAULT_SEED_COUNT = 50;

const seedCombos = [
  { tokenId: "usdc", networkId: "ethereum" },
  { tokenId: "usdc", networkId: "base" },
  { tokenId: "usdt", networkId: "ethereum" },
  { tokenId: "usdt", networkId: "base" },
  { tokenId: "eth", networkId: "ethereum" },
  { tokenId: "eth", networkId: "base" },
  { tokenId: "sol", networkId: "solana" },
] as const;

function randomEthAddress() {
  return `0x${randomBytes(20).toString("hex")}`;
}

function realisticAmount(index: number) {
  const whole = 12 + ((index * 19) % 380);
  const fraction = ((index * 37) % 97) + 1;
  return Math.round((whole + fraction / 100) * 100) / 100;
}

function daysAgoDate(days: number, hourOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10 + (hourOffset % 8), (hourOffset * 11) % 60, 0, 0);
  return date;
}

async function clearWorkspacePaymentData(workspaceId: ObjectId) {
  const db = await getDb();

  await Promise.all([
    db.collection(COLLECTIONS.paymentLinks).deleteMany({ workspaceId }),
    db.collection(COLLECTIONS.transactions).deleteMany({
      workspaceId,
      paymentLinkId: { $exists: true },
    }),
  ]);
}

async function ensureUserPaymentProfile(user: UserDoc) {
  const db = await getDb();

  let username = user.username?.trim().toLowerCase();
  if (!username) {
    username =
      user.email
        ?.split("@")[0]
        ?.replace(/[^a-z0-9]/gi, "")
        .toLowerCase()
        .slice(0, 24) || `pay-${user._id.toString().slice(-8)}`;

    await db.collection(COLLECTIONS.users).updateOne(
      { _id: user._id },
      { $set: { username, updatedAt: new Date() } },
    );
  }

  let recipientAddress = user.walletAddresses[0]?.toLowerCase();
  if (!recipientAddress) {
    recipientAddress = randomEthAddress();
    await db.collection(COLLECTIONS.users).updateOne(
      { _id: user._id },
      {
        $set: { updatedAt: new Date() },
        $addToSet: { walletAddresses: recipientAddress },
      },
    );
  }

  return { username, recipientAddress };
}

export async function replaceWorkspacePaymentLinksWithSeed(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  username: string;
  recipientAddress?: string;
  count?: number;
}) {
  const db = await getDb();
  const count = input.count ?? DEFAULT_SEED_COUNT;
  const normalizedUsername = input.username.trim().toLowerCase();
  const recipientAddress =
    input.recipientAddress?.toLowerCase() ?? randomEthAddress();

  await clearWorkspacePaymentData(input.workspaceId);

  let inserted = 0;

  for (let index = 0; index < count; index += 1) {
    const combo = seedCombos[index % seedCombos.length];
    const amount = realisticAmount(index + 1);
    const createdAt = daysAgoDate(Math.floor((index / count) * 60), index);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + (5 + (index % 10)));

    const created = await createPaymentLink({
      workspaceId: input.workspaceId,
      userId: input.userId,
      username: normalizedUsername,
      recipientAddress,
      amount,
      tokenId: combo.tokenId,
      networkId: combo.networkId,
      expiresAt,
      logActivity: false,
    });

    await db.collection(COLLECTIONS.paymentLinks).updateOne(
      { _id: new ObjectId(created.id) },
      {
        $set: {
          status: "pending",
          createdAt,
          updatedAt: createdAt,
          recipientAddress,
        },
        $unset: {
          paidAt: "",
          paidBy: "",
          paidTxHash: "",
        },
      },
    );

    inserted += 1;
  }

  return { inserted, deleted: true };
}

export async function seedPaymentLinksForWorkspace(input: {
  workspaceId: ObjectId;
  userId: ObjectId;
  count?: number;
}) {
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: input.userId,
  });

  if (!user) {
    throw new Error("User not found for workspace seed");
  }

  const { username, recipientAddress } = await ensureUserPaymentProfile(user);

  const result = await replaceWorkspacePaymentLinksWithSeed({
    workspaceId: input.workspaceId,
    userId: input.userId,
    username,
    recipientAddress,
    count: input.count,
  });

  return {
    email: user.email,
    username,
    workspaceId: input.workspaceId.toString(),
    ...result,
  };
}

export async function seedPaymentLinksForUserEmail(
  email: string,
  count = DEFAULT_SEED_COUNT,
) {
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({ email });

  if (!user) {
    throw new Error(`No user found for ${email}`);
  }

  const membership = await db.collection(COLLECTIONS.workspaceMembers).findOne({
    userId: user._id,
  });

  if (!membership) {
    throw new Error("User is not a member of any workspace");
  }

  return seedPaymentLinksForWorkspace({
    workspaceId: membership.workspaceId,
    userId: user._id,
    count,
  });
}

export async function seedPaymentLinksForAllWorkspaces(
  count = DEFAULT_SEED_COUNT,
) {
  const db = await getDb();
  const memberships = await db
    .collection(COLLECTIONS.workspaceMembers)
    .find({})
    .toArray();

  const uniqueByWorkspace = new Map<string, (typeof memberships)[number]>();
  for (const membership of memberships) {
    uniqueByWorkspace.set(membership.workspaceId.toString(), membership);
  }

  const results = [];

  for (const membership of uniqueByWorkspace.values()) {
    results.push(
      await seedPaymentLinksForWorkspace({
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        count,
      }),
    );
  }

  if (results.length === 0) {
    throw new Error("No workspaces found to seed");
  }

  return results;
}

export async function seedPaymentLinksForActiveSessions(
  count = DEFAULT_SEED_COUNT,
) {
  const db = await getDb();
  const sessions = await db
    .collection<SessionDoc>(COLLECTIONS.sessions)
    .find({ expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();

  const uniqueByWorkspace = new Map<string, SessionDoc>();
  for (const session of sessions) {
    uniqueByWorkspace.set(session.workspaceId.toString(), session);
  }

  if (uniqueByWorkspace.size === 0) {
    return seedPaymentLinksForAllWorkspaces(count);
  }

  const results = [];

  for (const session of uniqueByWorkspace.values()) {
    results.push(
      await seedPaymentLinksForWorkspace({
        workspaceId: session.workspaceId,
        userId: session.userId,
        count,
      }),
    );
  }

  return results;
}
