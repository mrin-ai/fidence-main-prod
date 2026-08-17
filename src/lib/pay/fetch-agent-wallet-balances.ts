import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { createPublicClient, erc20Abi, formatUnits, http, type Chain } from "viem";
import { base, mainnet, sepolia } from "viem/chains";

import { getTokenContract } from "@/lib/payment-contracts";
import { getSolanaTokenMint } from "@/lib/payment/solana-contracts";
import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getSolanaRpcUrl } from "@/lib/solana-config";
import { getWalletNetworkLabel, getWalletNetworkIcon } from "@/lib/wallet-networks";

export type WalletBalanceLine = {
  tokenId: string;
  symbol: string;
  amount: string;
  raw: string;
};

export type AgentWalletBalanceView = {
  walletId: string;
  networkId: string;
  networkLabel: string;
  networkIcon?: string;
  address: string;
  verifiedAt?: string;
  balances: WalletBalanceLine[];
  balanceError?: string;
};

const evmChains: Record<string, Chain> = {
  ethereum: mainnet,
  base,
  sepolia,
};

function formatDecimal(value: bigint, decimals: number, maxFraction = 6) {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  if (!fraction || maxFraction <= 0) return whole;
  return `${whole}.${fraction.slice(0, maxFraction).replace(/0+$/, "") || "0"}`;
}

async function fetchEvmBalances(networkId: string, address: string): Promise<WalletBalanceLine[]> {
  const chain = evmChains[networkId];
  const rpcUrl = getEvmRpcUrl(networkId);
  if (!chain || !rpcUrl) {
    throw new Error(`RPC not configured for ${networkId}`);
  }

  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletAddress = address as `0x${string}`;
  const lines: WalletBalanceLine[] = [];

  const nativeBalance = await client.getBalance({ address: walletAddress });
  lines.push({
    tokenId: "eth",
    symbol: networkId === "sepolia" ? "ETH" : "ETH",
    amount: formatDecimal(nativeBalance, 18, 6),
    raw: nativeBalance.toString(),
  });

  for (const tokenId of ["usdc", "usdt"] as const) {
    const token = getTokenContract(networkId, tokenId);
    if (!token) continue;

    const balance = await client.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    lines.push({
      tokenId,
      symbol: tokenId.toUpperCase(),
      amount: formatDecimal(balance, token.decimals, 4),
      raw: balance.toString(),
    });
  }

  return lines;
}

async function fetchSolanaBalances(address: string): Promise<WalletBalanceLine[]> {
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const owner = new PublicKey(address);
  const lines: WalletBalanceLine[] = [];

  const lamports = await connection.getBalance(owner);
  lines.push({
    tokenId: "sol",
    symbol: "SOL",
    amount: (lamports / LAMPORTS_PER_SOL).toFixed(6).replace(/\.?0+$/, "") || "0",
    raw: lamports.toString(),
  });

  for (const tokenId of ["usdc", "usdt"] as const) {
    const config = getSolanaTokenMint(tokenId);
    if (!config) continue;

    try {
      const mint = new PublicKey(config.mint);
      const ata = await getAssociatedTokenAddress(mint, owner);
      const account = await getAccount(connection, ata);
      lines.push({
        tokenId,
        symbol: tokenId.toUpperCase(),
        amount: formatDecimal(account.amount, config.decimals, 4),
        raw: account.amount.toString(),
      });
    } catch {
      lines.push({
        tokenId,
        symbol: tokenId.toUpperCase(),
        amount: "0",
        raw: "0",
      });
    }
  }

  return lines;
}

export async function fetchAgentWalletBalances(input: {
  networkId: string;
  address: string;
  walletId: string;
  verifiedAt?: string;
}): Promise<AgentWalletBalanceView> {
  const networkLabel = getWalletNetworkLabel(input.networkId);
  const baseView: AgentWalletBalanceView = {
    walletId: input.walletId,
    networkId: input.networkId,
    networkLabel,
    networkIcon: getWalletNetworkIcon(input.networkId),
    address: input.address,
    verifiedAt: input.verifiedAt,
    balances: [],
  };

  try {
    const balances =
      input.networkId === "solana"
        ? await fetchSolanaBalances(input.address)
        : await fetchEvmBalances(input.networkId, input.address);

    return { ...baseView, balances };
  } catch (error) {
    return {
      ...baseView,
      balanceError:
        error instanceof Error ? error.message : "Could not load balances for this wallet",
    };
  }
}
