import { contractSettlementVerifier } from "./verify-contract";
import { wagmiSettlementVerifier } from "./verify-wagmi";
import type { PaymentSettlementVerifier } from "./types";

export function getSettlementVerifier(): PaymentSettlementVerifier {
  const mode = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE ?? "wagmi";
  if (mode === "contract") {
    return contractSettlementVerifier;
  }
  return wagmiSettlementVerifier;
}

export type { SettlementIntent, PaymentSettlementVerifier } from "./types";
