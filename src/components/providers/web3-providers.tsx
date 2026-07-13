"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, cookieToInitialState, type State } from "wagmi";
import { mainnet } from "wagmi/chains";
import { wagmiConfig } from "@/lib/wagmi-config";
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

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState as State}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={mainnet}
          theme={lightTheme({
            accentColor: "#0066ff",
            accentColorForeground: "white",
            borderRadius: "large",
          })}
        >
          <SolanaWalletProvider>{children}</SolanaWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
