import { contractSettlementVerifier } from "./verify-contract";
import { solanaSettlementVerifier } from "./verify-solana";
import { wagmiSettlementVerifier } from "./verify-wagmi";
import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

function getEvmSettlementVerifier(): PaymentSettlementVerifier {
  const mode = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE ?? "wagmi";
  if (mode === "contract") {
    return contractSettlementVerifier;
  }
  return wagmiSettlementVerifier;
}

const evmSettlementVerifier = getEvmSettlementVerifier();

export function getSettlementVerifier(): PaymentSettlementVerifier {
  return {
    async verifySettlement(intent: SettlementIntent, txHash: string) {
      if (intent.networkId === "solana") {
        return solanaSettlementVerifier.verifySettlement(intent, txHash);
      }
      return evmSettlementVerifier.verifySettlement(intent, txHash);
    },
  };
}

export type { SettlementIntent, PaymentSettlementVerifier } from "./types";
