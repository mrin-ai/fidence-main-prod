export type SolanaTokenConfig = {
  mint: string;
  decimals: number;
};

const solanaTokenMints: Record<string, SolanaTokenConfig> = {
  usdc: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  usdt: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
  sol: {
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
};

export function getSolanaTokenMint(tokenId: string) {
  return solanaTokenMints[tokenId] ?? null;
}

export function supportsSolanaPayment(tokenId: string) {
  if (tokenId === "sol") return true;
  return Boolean(getSolanaTokenMint(tokenId));
}
