export function formatTokenUsdPrice(usd: number | null | undefined) {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return "—";

  if (usd >= 1_000) {
    return usd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  if (usd >= 1) {
    return usd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function formatTokenAmount(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "—";

  if (amount >= 1) {
    return amount.toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
  }

  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}
