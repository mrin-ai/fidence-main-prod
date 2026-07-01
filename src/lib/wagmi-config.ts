import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "LCX",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains: [mainnet, polygon, arbitrum, base],
  ssr: true,
});
