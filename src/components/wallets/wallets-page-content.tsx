"use client";

import { useState } from "react";

import { WalletList, type WalletListItem } from "@/components/wallets/wallet-list";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function WalletsPageContent({
  initialWallets,
  username,
  sessionWallet,
}: {
  initialWallets: WalletListItem[];
  username?: string | null;
  sessionWallet?: string | null;
}) {
  const [wallets, setWallets] = useState(initialWallets);

  return (
    <div className="w-full">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Wallets</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
        <WalletList
          wallets={wallets}
          username={username}
          sessionWallet={sessionWallet}
          onWalletRemoved={(id) =>
            setWallets((current) => current.filter((wallet) => wallet.id !== id))
          }
          onWalletAdded={(wallet) =>
            setWallets((current) => [
              ...current,
              {
                id: wallet.id,
                networkId: wallet.networkId,
                address: wallet.address,
                label: wallet.label,
                verifiedAt: wallet.verifiedAt,
              },
            ])
          }
        />
      </main>
    </div>
  );
}
