import type { Chain } from "viem";
import {
  arbitrum,
  avalanche,
  base,
  blast,
  bsc,
  celo,
  cronos,
  fantom,
  gnosis,
  linea,
  mainnet,
  mantle,
  metis,
  mode,
  moonbeam,
  opBNB,
  optimism,
  polygon,
  scroll,
  sepolia,
  sonic,
  taiko,
  unichain,
  worldchain,
  zkSync,
  zora,
} from "wagmi/chains";

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
  { id: "arbitrum", label: "Arbitrum", chain: arbitrum },
  { id: "optimism", label: "Optimism", chain: optimism },
  { id: "polygon", label: "Polygon", chain: polygon },
  { id: "bsc", label: "BNB Chain", chain: bsc },
  { id: "avalanche", label: "Avalanche", chain: avalanche },
  { id: "linea", label: "Linea", chain: linea },
  { id: "zksync", label: "zkSync Era", chain: zkSync },
  { id: "scroll", label: "Scroll", chain: scroll },
  { id: "blast", label: "Blast", chain: blast },
  { id: "mantle", label: "Mantle", chain: mantle },
  { id: "gnosis", label: "Gnosis", chain: gnosis },
  { id: "celo", label: "Celo", chain: celo },
  { id: "fantom", label: "Fantom", chain: fantom },
  { id: "moonbeam", label: "Moonbeam", chain: moonbeam },
  { id: "cronos", label: "Cronos", chain: cronos },
  { id: "opbnb", label: "opBNB", chain: opBNB },
  { id: "metis", label: "Metis", chain: metis },
  { id: "mode", label: "Mode", chain: mode },
  { id: "zora", label: "Zora", chain: zora },
  { id: "sonic", label: "Sonic", chain: sonic },
  { id: "taiko", label: "Taiko", chain: taiko },
  { id: "unichain", label: "Unichain", chain: unichain },
  { id: "worldchain", label: "World Chain", chain: worldchain },
];

const testnetWalletNetworks: EvmWalletNetwork[] = [
  {
    id: "sepolia",
    label: "Sepolia (testnet)",
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
  return networkByChainId.get(chainId)?.id;
}
