/** Platform token id → CoinGecko API coin id */
export const COINGECKO_COIN_IDS: Record<string, string> = {
  usdc: "usd-coin",
  usdt: "tether",
  eth: "ethereum",
  sol: "solana",
  lcx: "lcx",
};

export const STABLECOIN_TOKEN_IDS = new Set(["usdc", "usdt"]);

export function toCoingeckoCoinId(tokenId: string) {
  return COINGECKO_COIN_IDS[tokenId.trim().toLowerCase()] ?? null;
}

export function fromCoingeckoCoinId(coinId: string) {
  const normalized = coinId.trim().toLowerCase();
  for (const [tokenId, mapped] of Object.entries(COINGECKO_COIN_IDS)) {
    if (mapped === normalized) return tokenId;
  }
  return null;
}

export function normalizeTokenIds(tokenIds: string[]) {
  return [...new Set(tokenIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
}
