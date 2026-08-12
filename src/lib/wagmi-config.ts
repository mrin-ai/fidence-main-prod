import { getDefaultConfig } from "@rainbow-me/rainbowkit";

import { getEvmTransports } from "@/lib/evm-rpc";
import { getEvmWalletChains } from "@/lib/evm-networks";

const customTransports = getEvmTransports();

export const wagmiConfig = getDefaultConfig({
  appName: "Fidence",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains: getEvmWalletChains(),
  ssr: true,
  ...(customTransports ? { transports: customTransports } : {}),
});
