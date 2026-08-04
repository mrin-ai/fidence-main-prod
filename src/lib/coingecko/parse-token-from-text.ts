import { resolveTokenIdFromSymbol } from "@/lib/coingecko/resolve-token-id";

const TOKEN_AMOUNT_PATTERN =
  /(\d[\d,]*(?:\.\d+)?)\s+(USDC|USDT|ETH|SOL|LCX)\b/gi;

export function parseTokenAmountFromText(text: string) {
  const matches = [...text.matchAll(TOKEN_AMOUNT_PATTERN)];
  if (matches.length === 0) return null;

  const match = matches[matches.length - 1];
  const amount = Number(match[1].replaceAll(",", ""));
  const tokenId = resolveTokenIdFromSymbol(match[2]);

  if (!Number.isFinite(amount) || amount <= 0 || !tokenId) {
    return null;
  }

  return { amount, tokenId, symbol: match[2].toUpperCase() };
}

export const TOKEN_AMOUNT_ACTIVITY_TYPES = new Set([
  "payment_link_created",
  "invoice_payment_link_created",
  "invoice_payment_link_updated",
  "payment_received",
  "payment_sent",
  "profile_payment",
  "invoice_paid",
  "agent_link_created",
  "agent_payment_sent",
  "agent_payment_received",
]);
