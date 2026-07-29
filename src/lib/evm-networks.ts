import type { Chain } from "viem";
import { base, mainnet, sepolia } from "wagmi/chains";

import { testnetsEnabled } from "@/lib/testnets";

export type EvmWalletNetwork = {
  id: string;
  label: string;
  chain: Chain;
  testnet?: boolean;
};

const mainnetWalletNetworks: EvmWalletNetwork[] = [
  { id: "ethereum", label: "Ethereum", chain: mainnet },
  { id: "base", label: "Base", chain: base },
];

const testnetWalletNetworks: EvmWalletNetwork[] = [
  {
    id: "sepolia",
    label: "Sepolia",
    chain: sepolia,
    testnet: true,
  },
];

export const evmWalletNetworks: EvmWalletNetwork[] = testnetsEnabled()
  ? [...mainnetWalletNetworks, ...testnetWalletNetworks]
  : mainnetWalletNetworks;

const networkById = new Map(
  evmWalletNetworks.map((network) => [network.id, network]),
);

const networkByChainId = new Map(
  evmWalletNetworks.map((network) => [network.chain.id, network]),
);

export function getEvmWalletNetworkById(id: string) {
  return networkById.get(id);
}

export function getEvmWalletNetworkByChainId(chainId: number) {
  return networkByChainId.get(chainId);
}

export function getEvmWalletChains(): readonly [Chain, ...Chain[]] {
  const chains = evmWalletNetworks.map((network) => network.chain);
  return chains as unknown as readonly [Chain, ...Chain[]];
}

export function getEvmWalletNetworkIds() {
  return evmWalletNetworks.map((network) => network.id);
}

export function isSupportedEvmWalletNetworkId(id: string) {
  return networkById.has(id);
}

export function getEvmChainIdForNetwork(networkId: string) {
  return networkById.get(networkId)?.chain.id;
}

export function getEvmNetworkIdForChainId(chainId: number) {
  const fromList = networkByChainId.get(chainId)?.id;
  if (fromList) return fromList;

  // Sepolia chain id — keep wallet detection working if lists are stale.
  if (chainId === 11155111) return "sepolia";

  return undefined;
}
