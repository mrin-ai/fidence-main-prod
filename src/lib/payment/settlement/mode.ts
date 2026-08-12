export type SettlementVerifyMode = "wagmi" | "format" | "off" | "contract";

export function getSettlementVerifyMode(): SettlementVerifyMode | null {
  const raw = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "wagmi" || raw === "format" || raw === "off" || raw === "contract") {
    return raw;
  }
  return null;
}

/** Skip on-chain verification (format check or full skip). */
export function isFormatOnlySettlementVerification() {
  const mode = getSettlementVerifyMode();
  return mode === "format" || mode === "off";
}

/** Route to contract settlement verifier stub. */
export function isContractSettlementVerification() {
  return getSettlementVerifyMode() === "contract";
}
