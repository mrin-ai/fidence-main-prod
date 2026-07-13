import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { listVerifiedWallets } from "@/lib/db/wallets";
import { normalizeUsername } from "@/lib/db/profile";
import { getWalletNetworkById } from "@/lib/wallet-networks";
import { truncateAddress } from "@/lib/profile-url";
import type { UserDoc } from "@/lib/db/types";

export type PublicProfileWallet = {
  networkId: string;
  networkLabel: string;
  address: string;
  addressTruncated: string;
};

export type PublicProfile = {
  username: string;
  displayName: string;
  company?: string;
  wallets: PublicProfileWallet[];
};

export async function getPublicProfileByUsername(
  rawUsername: string,
): Promise<PublicProfile | null> {
  const username = normalizeUsername(rawUsername);
  const db = await getDb();

  const user = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    username,
  });

  if (!user) return null;

  const wallets = listVerifiedWallets(user).map((wallet) => {
    const network = getWalletNetworkById(wallet.networkId);
    return {
      networkId: wallet.networkId,
      networkLabel: network?.label ?? wallet.networkId,
      address: wallet.address,
      addressTruncated: truncateAddress(wallet.address),
    };
  });

  return {
    username: user.username!,
    displayName: user.name,
    company: user.profile?.company,
    wallets,
  };
}
