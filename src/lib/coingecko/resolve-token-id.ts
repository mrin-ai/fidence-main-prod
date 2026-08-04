import { paymentTokens } from "@/lib/create-payment-link-data";

export function resolveTokenIdFromSymbol(symbol: string) {
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) return null;

  const byId = paymentTokens.find((token) => token.id === normalized);
  if (byId) return byId.id;

  const bySymbol = paymentTokens.find(
    (token) => token.symbol.toLowerCase() === normalized,
  );
  return bySymbol?.id ?? null;
}

export function resolveTokenSymbol(tokenId: string, fallback?: string) {
  const token = paymentTokens.find(
    (entry) => entry.id === tokenId.trim().toLowerCase(),
  );
  return token?.symbol ?? fallback ?? tokenId.toUpperCase();
}
