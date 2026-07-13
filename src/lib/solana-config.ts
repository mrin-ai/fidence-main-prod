import { clusterApiUrl, type Cluster } from "@solana/web3.js";

export const SOLANA_NETWORK_ID = "solana";

export function getSolanaCluster(): Cluster {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim();
  if (cluster === "devnet" || cluster === "testnet" || cluster === "mainnet-beta") {
    return cluster;
  }
  return "mainnet-beta";
}

export function getSolanaRpcUrl() {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    clusterApiUrl(getSolanaCluster())
  );
}
