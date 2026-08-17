import { clusterApiUrl, type Cluster } from "@solana/web3.js";

export const SOLANA_NETWORK_ID = "solana";

export function getSolanaCluster(): Cluster {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER?.trim();
  if (cluster === "devnet" || cluster === "testnet" || cluster === "mainnet-beta") {
    return cluster;
  }
  return "mainnet-beta";
}

function getAlchemyApiKey() {
  return (
    process.env.ALCHEMY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY?.trim()
  );
}

function getAlchemySolanaRpcUrl() {
  const apiKey = getAlchemyApiKey();
  if (!apiKey) return undefined;
  return `https://solana-mainnet.g.alchemy.com/v2/${apiKey}`;
}

export function getSolanaRpcUrl() {
  return (
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    getAlchemySolanaRpcUrl() ||
    clusterApiUrl(getSolanaCluster())
  );
}
