import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

export const contractSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(_intent: SettlementIntent, _txHash: string) {
    // TODO: wire smart contract verification when backend is ready
    return false;
  },
};
