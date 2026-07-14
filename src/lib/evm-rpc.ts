import { http, type Transport } from "viem";

import {
  getEvmNetworkIdForChainId,
  getEvmWalletChains,
} from "@/lib/evm-networks";

const alchemyHostByNetworkId: Record<string, string> = {
  ethereum: "eth-mainnet",
  base: "base-mainnet",
  arbitrum: "arb-mainnet",
  polygon: "polygon-mainnet",
  optimism: "opt-mainnet",
  sepolia: "eth-sepolia",
};

function getAlchemyApiKey() {
  return (
    process.env.ALCHEMY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim()
  );
}

function getAlchemyRpcUrl(networkId: string) {
  const apiKey = getAlchemyApiKey();
  const host = alchemyHostByNetworkId[networkId];
  if (!apiKey || !host) return undefined;
  return `https://${host}.g.alchemy.com/v2/${apiKey}`;
}

const rpcUrlByNetworkId: Record<string, string | undefined> = {
  ethereum: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL,
  base: process.env.NEXT_PUBLIC_BASE_RPC_URL,
  arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL,
  polygon: process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
  optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL,
  sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
};

function resolveEvmRpcUrl(networkId: string | undefined) {
  if (!networkId) return undefined;
  return (
    rpcUrlByNetworkId[networkId]?.trim() ||
    getAlchemyRpcUrl(networkId)
  );
}

export function getEvmRpcUrl(networkId: string) {
  return resolveEvmRpcUrl(networkId);
}

export function getEvmTransports() {
  const chains = getEvmWalletChains();
  const transports: Record<number, Transport> = {};
  let hasCustomRpc = false;

  for (const chain of chains) {
    const networkId = getEvmNetworkIdForChainId(chain.id);
    const rpcUrl = resolveEvmRpcUrl(networkId);

    if (rpcUrl) {
      transports[chain.id] = http(rpcUrl);
      hasCustomRpc = true;
    } else {
      transports[chain.id] = http();
    }
  }

  return hasCustomRpc ? transports : undefined;
}
