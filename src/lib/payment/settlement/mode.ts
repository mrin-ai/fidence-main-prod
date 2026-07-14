export function isFormatOnlySettlementVerification() {
  const mode = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE?.trim().toLowerCase();
  return mode === "wagmi" || mode === "format" || mode === "off";
}
