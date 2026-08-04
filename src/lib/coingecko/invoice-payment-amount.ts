import {
  convertFiatTotalToTokenAmount,
  roundPaymentTokenAmount,
} from "@/lib/coingecko/convert-fiat-to-token";
import { fetchTokenPricesUsd } from "@/lib/coingecko/fetch-prices";

export async function resolveInvoicePaymentTokenAmount(input: {
  fiatTotal: number;
  fiatCurrency: string;
  tokenId: string;
}) {
  const snapshot = await fetchTokenPricesUsd([input.tokenId]);
  const tokenPriceUsd = snapshot.prices[input.tokenId.trim().toLowerCase()] ?? null;

  const conversion = convertFiatTotalToTokenAmount({
    fiatTotal: input.fiatTotal,
    fiatCurrency: input.fiatCurrency,
    tokenId: input.tokenId,
    tokenPriceUsd,
  });

  if (!conversion) {
    throw new Error(
      "Unable to convert invoice total to crypto. Check the token and try again.",
    );
  }

  return roundPaymentTokenAmount(conversion.tokenAmount, input.tokenId);
}
