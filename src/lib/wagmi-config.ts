import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Chain } from "viem";
import { arbitrum, base, mainnet, polygon, sepolia } from "wagmi/chains";
import { testnetsEnabled } from "@/lib/testnets";

const chains: readonly [Chain, ...Chain[]] = testnetsEnabled()
  ? [mainnet, polygon, arbitrum, base, sepolia]
  : [mainnet, polygon, arbitrum, base];

export const wagmiConfig = getDefaultConfig({
  appName: "LCX",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    "00000000000000000000000000000000",
  chains,
  ssr: true,
});
