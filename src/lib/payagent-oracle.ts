import type { Abi } from "viem";

/**
 * PAYAGENT price oracle (Sepolia)
 *
 * Set in .env.local:
 *   NEXT_PUBLIC_PAYAGENT_ORACLE_ADDRESS=0x...
 */
export const PAYAGENT_ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_PAYAGENT_ORACLE_ADDRESS as `0x${string}` | undefined) ??
  "0x2d71B6125f0E4aE43D333F78A339552DD6A4512d";

export const PAYAGENT_ORACLE_PRICE_DECIMALS = 8;

export const PAYAGENT_ORACLE_ABI = [
  {
    type: "function",
    name: "latestPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setPrice",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPrice", type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

export function formatOracleUsdPrice(rawPrice?: bigint) {
  if (rawPrice === undefined) return null;
  const dollars = Number(rawPrice) / 10 ** PAYAGENT_ORACLE_PRICE_DECIMALS;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(dollars);
}

export function tokenUsdValue(tokenAmount: number, rawOraclePrice?: bigint) {
  if (rawOraclePrice === undefined) return null;
  const price = Number(rawOraclePrice) / 10 ** PAYAGENT_ORACLE_PRICE_DECIMALS;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(tokenAmount * price);
}
