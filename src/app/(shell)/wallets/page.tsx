import { WalletsPageContent } from "@/components/wallets/wallets-page-content";
import { requireShellSession } from "@/lib/shell-session";
import {
  listVerifiedWalletsForUser,
  verifiedWalletVerifiedAtIso,
} from "@/lib/db/wallets";

export default async function WalletsPage() {
  const { session } = await requireShellSession("/wallets");
  const wallets = await listVerifiedWalletsForUser(session.user._id);

  const walletItems = wallets.map((wallet) => ({
    id: wallet.id,
    networkId: wallet.networkId,
    address: wallet.address,
    label: wallet.label,
    verifiedAt: verifiedWalletVerifiedAtIso(wallet),
  }));

  const sessionWallet =
    session.session.walletAddress ??
    session.user.authProviders.find((provider) => provider.type === "wallet")
      ?.providerId ??
    null;

  return (
    <WalletsPageContent
      initialWallets={walletItems}
      username={session.user.username}
      sessionWallet={sessionWallet}
    />
  );
}
