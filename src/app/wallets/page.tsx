import { redirect } from "next/navigation";

import { WalletsPageContent } from "@/components/wallets/wallets-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listVerifiedWallets } from "@/lib/db/wallets";
export default async function WalletsPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/wallets");
  }

  const wallets = listVerifiedWallets(session.user).map((wallet) => ({
    id: wallet.id,
    networkId: wallet.networkId,
    address: wallet.address,
    label: wallet.label,
    verifiedAt: wallet.verifiedAt.toISOString(),
  }));

  const sessionWallet =
    session.session.walletAddress ??
    session.user.authProviders.find((provider) => provider.type === "wallet")
      ?.providerId ??
    null;

  return (
    <WalletsPageContent
      initialWallets={wallets}
      username={session.user.username}
      sessionWallet={sessionWallet}
    />
  );
}
