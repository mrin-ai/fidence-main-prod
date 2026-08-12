import { POLICY_CODES, type PolicyCode } from "@/lib/compliance/codes";

const STABLECOIN_IDS = new Set(["usdc", "usdt"]);

export type ValuationResult =
  | { ok: true; amountUsd: number }
  | { ok: false; code: PolicyCode };

/**
 * Convert a payment amount into USD for policy caps.
 * Stablecoins: 1:1. Non-stablecoins fail closed until a reliable price source exists.
 */
export function toPolicyAmountUsd(
  amount: number,
  tokenId: string,
): ValuationResult {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, code: POLICY_CODES.POLICY_EVAL_ERROR };
  }

  const normalized = tokenId.trim().toLowerCase();
  if (STABLECOIN_IDS.has(normalized)) {
    return { ok: true, amountUsd: amount };
  }

  // ETH / SOL: no reliable mainnet oracle wired for enforcement yet.
  return { ok: false, code: POLICY_CODES.AMOUNT_VALUATION_UNAVAILABLE };
}
