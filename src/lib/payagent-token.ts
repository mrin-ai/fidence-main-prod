import type { Abi } from "viem";
import { sepolia } from "wagmi/chains";

/**
 * PAYAGENT token (Sepolia UUPS proxy)
 *
 * Paste your deployed proxy address here or set:
 *   NEXT_PUBLIC_PAYAGENT_TOKEN_ADDRESS=0x...
 *
 * Paste the contract ABI in PAYAGENT_ABI below, or import it from:
 *   solidity/artifacts/contracts/PAYAGENT.sol/PAYAGENT.json → "abi" field
 */
export const PAYAGENT_TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_PAYAGENT_TOKEN_ADDRESS as `0x${string}` | undefined) ??
  "0xa7CA8c3dB6455Eba6213b25348894F3D6E97F6a1";

export const PAYAGENT_TOKEN_CHAIN = sepolia;
export const PAYAGENT_TOKEN_DECIMALS = 6;
export const PAYAGENT_TOKEN_SYMBOL = "PAYAGENT";

export const PAYAGENT_ABI = [
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const satisfies Abi;
