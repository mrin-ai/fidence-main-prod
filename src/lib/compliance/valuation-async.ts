import { fetchTokenPricesUsd } from "@/lib/coingecko/fetch-prices";
import { POLICY_CODES, type PolicyCode } from "@/lib/compliance/codes";
import { toPolicyAmountUsd } from "@/lib/compliance/valuation";

const STABLECOIN_IDS = new Set(["usdc", "usdt"]);
const NATIVE_TOKEN_IDS = new Set(["eth", "sol"]);

export type AsyncValuationResult =
  | { ok: true; amountUsd: number; priceUsd?: number; priceAsOf?: string }
  | { ok: false; code: PolicyCode };

export async function toPolicyAmountUsdAsync(
  amount: number,
  tokenId: string,
): Promise<AsyncValuationResult> {
  const sync = toPolicyAmountUsd(amount, tokenId);
  if (sync.ok) {
    return { ok: true, amountUsd: sync.amountUsd };
  }

  const normalized = tokenId.trim().toLowerCase();
  if (!NATIVE_TOKEN_IDS.has(normalized)) {
    return sync;
  }

  try {
    const snapshot = await fetchTokenPricesUsd([normalized]);
    const priceUsd = snapshot.prices[normalized];
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return { ok: false, code: POLICY_CODES.AMOUNT_VALUATION_UNAVAILABLE };
    }
    return {
      ok: true,
      amountUsd: amount * priceUsd,
      priceUsd,
      priceAsOf: snapshot.asOf,
    };
  } catch {
    return { ok: false, code: POLICY_CODES.AMOUNT_VALUATION_UNAVAILABLE };
  }
}
