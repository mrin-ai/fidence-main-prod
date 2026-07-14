import { arbitrum, base, mainnet, polygon, sepolia } from "wagmi/chains";

import {
  getEvmChainIdForNetwork,
  getEvmNetworkIdForChainId,
} from "@/lib/evm-networks";
import { supportsSolanaPayment } from "@/lib/payment/solana-contracts";

export const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type TokenContract = {
  address: `0x${string}`;
  decimals: number;
};

const tokenContracts: Record<string, Record<string, TokenContract>> = {
  base: {
    usdc: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    usdt: {
      address: "0xfde4C96c8593ccC8a38670E7C458b6d9d10ad",
      decimals: 6,
    },
  },
  ethereum: {
    usdc: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
    usdt: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
  },
  arbitrum: {
    usdc: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
    usdt: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
  },
  polygon: {
    usdc: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
    usdt: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
  },
  sepolia: {
    usdc: {
      address: "0x3402d41AA8e34e0DF605c12109de2f8F4FF33A87",
      decimals: 6,
    },
    usdt: {
      address: "0x7169d38820dfd117c3Fa1f22a697dBA58d90BA06",
      decimals: 6,
    },
  },
};

const legacyPaymentChainIds: Record<string, number> = {
  ethereum: mainnet.id,
  base: base.id,
  arbitrum: arbitrum.id,
  polygon: polygon.id,
  sepolia: sepolia.id,
};

export function getChainIdForNetwork(networkId: string) {
  return getEvmChainIdForNetwork(networkId) ?? legacyPaymentChainIds[networkId];
}

export function getNetworkIdForChainId(chainId: number) {
  return getEvmNetworkIdForChainId(chainId);
}

export function getTokenContract(networkId: string, tokenId: string) {
  return tokenContracts[networkId]?.[tokenId] ?? null;
}

export function supportsOnChainPayment(networkId: string, tokenId: string) {
  if (networkId === "solana") return supportsSolanaPayment(tokenId);
  if (tokenId === "eth") return Boolean(getChainIdForNetwork(networkId));
  return Boolean(getTokenContract(networkId, tokenId));
}
