"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, cookieToInitialState, type State } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi-config";
import { getEvmWalletChains } from "@/lib/evm-networks";
import { SolanaWalletProvider } from "@/components/providers/solana-wallet-provider";

export function Web3Providers({
  children,
  cookie,
}: {
  children: ReactNode;
  cookie?: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(wagmiConfig, cookie);
  const initialChain = getEvmWalletChains()[0];

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState as State}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={initialChain}
          theme={lightTheme({
            accentColor: "#d5c515",
            accentColorForeground: "#1a1808",
            borderRadius: "large",
          })}
        >
          <SolanaWalletProvider>{children}</SolanaWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
