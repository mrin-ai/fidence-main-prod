import { getEvmWalletNetworkById } from "@/lib/evm-networks";

const legacyExplorerBases: Record<string, string> = {
  solana: "https://solscan.io/tx/",
};

export function getTxExplorerUrl(networkId: string, txHash: string) {
  if (!txHash) return null;

  const legacyBase = legacyExplorerBases[networkId];
  if (legacyBase) {
    return `${legacyBase}${txHash}`;
  }

  const network = getEvmWalletNetworkById(networkId);
  const base = network?.chain.blockExplorers?.default?.url;
  if (!base) return null;

  return `${base}/tx/${txHash}`;
}
