import { randomUUID } from "crypto";
import type { ObjectId } from "mongodb";

import { getEvmWalletNetworkIds } from "@/lib/evm-networks";
import { getWalletNetworkById, getWalletNetworkLabel } from "@/lib/wallet-networks";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type {
  UserDoc,
  VerifiedWallet,
  WalletNetworkId,
} from "@/lib/db/types";

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const EVM_NETWORK_IDS = getEvmWalletNetworkIds();

export function isEvmAddress(address: string) {
  return EVM_ADDRESS_REGEX.test(address);
}

export function normalizeWalletAddress(address: string, networkId: WalletNetworkId) {
  if (networkId === "solana") {
    return address.trim();
  }
  return address.trim().toLowerCase();
}

export function listVerifiedWallets(user: UserDoc): VerifiedWallet[] {
  return user.verifiedWallets ?? [];
}

export function verifiedWalletVerifiedAtIso(wallet: VerifiedWallet) {
  const value = wallet.verifiedAt;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export function getVerifiedWalletForNetwork(
  user: UserDoc,
  networkId: string,
): VerifiedWallet | null {
  return (
    listVerifiedWallets(user).find((wallet) => wallet.networkId === networkId) ??
    null
  );
}

export function resolveRecipientAddress(
  user: UserDoc,
  networkId: string,
): string | null {
  return getVerifiedWalletForNetwork(user, networkId)?.address ?? null;
}

export async function listVerifiedWalletsForUser(userId: ObjectId) {
  const db = await getDb();
  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });
  if (!user) return [];
  return listVerifiedWallets(user);
}

export async function addVerifiedWallet(
  userId: ObjectId,
  input: {
    networkId: WalletNetworkId;
    address: string;
    label?: string;
    verificationMethod: VerifiedWallet["verificationMethod"];
  },
) {
  const db = await getDb();
  const now = new Date();
  const normalizedAddress = normalizeWalletAddress(input.address, input.networkId);

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });

  if (!user) {
    return { ok: false as const, error: "User not found" };
  }

  const existingWallets = listVerifiedWallets(user);
  const duplicateNetwork = existingWallets.find(
    (wallet) => wallet.networkId === input.networkId,
  );

  if (duplicateNetwork) {
    return {
      ok: false as const,
      error: `You already have a verified wallet for ${getWalletNetworkLabel(input.networkId)}`,
    };
  }

  const duplicateAddress = existingWallets.find(
    (wallet) =>
      wallet.networkId === input.networkId &&
      wallet.address === normalizedAddress,
  );

  if (duplicateAddress) {
    return { ok: false as const, error: "This wallet is already verified" };
  }

  const wallet: VerifiedWallet = {
    id: randomUUID(),
    networkId: input.networkId,
    address: normalizedAddress,
    label: input.label?.trim() || undefined,
    verifiedAt: now,
    verificationMethod: input.verificationMethod,
  };

  await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId },
    {
      $push: { verifiedWallets: wallet },
      $addToSet: { walletAddresses: normalizedAddress },
      $set: { updatedAt: now },
    },
  );

  return { ok: true as const, wallet };
}

export async function updateVerifiedWalletLabel(
  userId: ObjectId,
  walletId: string,
  label?: string,
) {
  const db = await getDb();
  const now = new Date();
  const trimmed = label?.trim();

  const result = await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId, "verifiedWallets.id": walletId },
    trimmed
      ? {
          $set: {
            "verifiedWallets.$.label": trimmed,
            updatedAt: now,
          },
        }
      : {
          $unset: { "verifiedWallets.$.label": "" },
          $set: { updatedAt: now },
        },
  );

  if (result.matchedCount === 0) {
    return { ok: false as const, error: "Wallet not found" };
  }

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });
  const wallet = user
    ? listVerifiedWallets(user).find((entry) => entry.id === walletId)
    : undefined;

  if (!wallet) {
    return { ok: false as const, error: "Wallet not found" };
  }

  return { ok: true as const, wallet };
}

export async function removeVerifiedWallet(userId: ObjectId, walletId: string) {
  const db = await getDb();
  const now = new Date();

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: userId,
  });

  if (!user) {
    return { ok: false as const, error: "User not found" };
  }

  const wallet = listVerifiedWallets(user).find((entry) => entry.id === walletId);
  if (!wallet) {
    return { ok: false as const, error: "Wallet not found" };
  }

  await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
    { _id: userId },
    {
      $pull: { verifiedWallets: { id: walletId } },
      $set: { updatedAt: now },
    },
  );

  return { ok: true as const, wallet };
}

export function requireRecipientAddress(user: UserDoc, networkId: string) {
  const recipientAddress = resolveRecipientAddress(user, networkId);
  if (!recipientAddress) {
    const network = getWalletNetworkById(networkId);
    return {
      ok: false as const,
      error: `Add and verify a wallet for ${network?.label ?? networkId} in Wallets`,
      code: "WALLET_NOT_VERIFIED_FOR_NETWORK" as const,
    };
  }
  return { ok: true as const, recipientAddress };
}

export async function migrateWalletAddressesToVerifiedWallets() {
  const db = await getDb();
  const users = await db
    .collection<UserDoc>(COLLECTIONS.users)
    .find({
      walletAddresses: { $exists: true, $ne: [] },
      verifiedWallets: { $exists: false },
    })
    .toArray();

  let migrated = 0;

  for (const user of users) {
    const address = user.walletAddresses[0]?.toLowerCase();
    if (!address || !isEvmAddress(address)) continue;

    const verifiedWallets: VerifiedWallet[] = EVM_NETWORK_IDS.map((networkId) => ({
      id: randomUUID(),
      networkId,
      address,
      verifiedAt: user.createdAt,
      verificationMethod: "eip191" as const,
    }));

    await db.collection<UserDoc>(COLLECTIONS.users).updateOne(
      { _id: user._id },
      {
        $set: {
          verifiedWallets,
          updatedAt: new Date(),
        },
      },
    );

    migrated += 1;
  }

  return { migrated };
}
