import { contractSettlementVerifier } from "./verify-contract";
import { isContractSettlementVerification } from "./mode";
import { solanaSettlementVerifier } from "./verify-solana";
import { wagmiSettlementVerifier } from "./verify-wagmi";
import type {
  PaymentSettlementVerifier,
  SettlementIntent,
  SettlementVerifyResult,
} from "./types";

function getEvmSettlementVerifier(): PaymentSettlementVerifier {
  if (isContractSettlementVerification()) {
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
    async verifySettlementDetailed(
      intent: SettlementIntent,
      txHash: string,
    ): Promise<SettlementVerifyResult> {
      if (intent.networkId === "solana") {
        return solanaSettlementVerifier.verifySettlementDetailed(intent, txHash);
      }
      return evmSettlementVerifier.verifySettlementDetailed(intent, txHash);
    },
  };
}

export type {
  SettlementIntent,
  PaymentSettlementVerifier,
  SettlementVerifyResult,
} from "./types";
