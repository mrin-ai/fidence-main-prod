import { getDefaultConfig } from "@rainbow-me/rainbowkit";

import { getEvmWalletChains } from "@/lib/evm-networks";

export const wagmiConfig = getDefaultConfig({
  appName: "LCX",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains: getEvmWalletChains(),
  ssr: true,
});
