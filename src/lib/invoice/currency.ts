export const currenciesWithSymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  USDC: "USDC",
  USDT: "USDT",
};

export function formatCurrency(amount: number, currency: string) {
  const symbol = currenciesWithSymbols[currency] ?? currency;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (symbol.length <= 2) {
    return `${symbol}${formatted}`;
  }

  return `${formatted} ${symbol}`;
}
