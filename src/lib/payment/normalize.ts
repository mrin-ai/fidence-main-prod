import { SOLANA_NETWORK_ID } from "@/lib/solana-config";

export function isSolanaNetwork(networkId: string) {
  return networkId === SOLANA_NETWORK_ID;
}

export function normalizePaymentAddress(address: string, networkId: string) {
  const trimmed = address.trim();
  if (isSolanaNetwork(networkId)) {
    return trimmed;
  }
  return trimmed.toLowerCase();
}

export function normalizeTxHash(txHash: string, networkId: string) {
  const trimmed = txHash.trim();
  if (isSolanaNetwork(networkId)) {
    return trimmed;
  }
  return trimmed.toLowerCase();
}
