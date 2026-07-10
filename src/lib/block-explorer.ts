const txExplorerBases: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  sepolia: "https://sepolia.etherscan.io/tx/",
};

export function getTxExplorerUrl(networkId: string, txHash: string) {
  const base = txExplorerBases[networkId];
  if (!base || !txHash) return null;
  return `${base}${txHash}`;
}
