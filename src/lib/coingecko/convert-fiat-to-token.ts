import { STABLECOIN_TOKEN_IDS } from "@/lib/coingecko/token-map";

export type FiatToTokenConversion = {
  /** Amount the client pays on-chain, in token units */
  tokenAmount: number;
  /** USD value used for conversion (invoice total treated as USD when currency is USD) */
  usdBasis: number;
};

export function convertFiatTotalToTokenAmount(input: {
  fiatTotal: number;
  fiatCurrency: string;
  tokenId: string;
  tokenPriceUsd: number | null;
}): FiatToTokenConversion | null {
  const { fiatTotal, fiatCurrency, tokenId, tokenPriceUsd } = input;

  if (!Number.isFinite(fiatTotal) || fiatTotal <= 0) {
    return null;
  }

  const normalizedToken = tokenId.trim().toLowerCase();
  const currency = fiatCurrency.trim().toUpperCase();

  // USD invoices map 1:1 to USD value. Other fiat uses the numeric total as settlement
  // basis until dedicated FX rates are added.
  const usdBasis = fiatTotal;

  if (STABLECOIN_TOKEN_IDS.has(normalizedToken)) {
    if (currency === "USD" || currency === "USDC" || currency === "USDT") {
      return { tokenAmount: fiatTotal, usdBasis: fiatTotal };
    }
    return { tokenAmount: fiatTotal, usdBasis: fiatTotal };
  }

  if (!tokenPriceUsd || !Number.isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
    return null;
  }

  return {
    tokenAmount: usdBasis / tokenPriceUsd,
    usdBasis,
  };
}

export function roundPaymentTokenAmount(tokenAmount: number, tokenId: string) {
  const normalized = tokenId.trim().toLowerCase();
  const decimals =
    normalized === "eth" || normalized === "sol" ? 8 : normalized === "lcx" ? 6 : 2;
  const factor = 10 ** decimals;
  return Math.ceil(tokenAmount * factor) / factor;
}
