import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  listVerifiedWallets,
  listVerifiedWalletsForUser,
} from "@/lib/db/wallets";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallets = await listVerifiedWalletsForUser(session.user._id);
  const sessionWallet =
    session.session.walletAddress ??
    session.user.authProviders.find((provider) => provider.type === "wallet")
      ?.providerId;

  return NextResponse.json({
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      networkId: wallet.networkId,
      address: wallet.address,
      label: wallet.label,
      verifiedAt: wallet.verifiedAt.toISOString(),
      verificationMethod: wallet.verificationMethod,
    })),
    sessionWallet: sessionWallet ?? null,
    username: session.user.username ?? null,
    hasUsername: Boolean(session.user.username),
    verifiedNetworkIds: listVerifiedWallets(session.user).map(
      (wallet) => wallet.networkId,
    ),
  });
}
