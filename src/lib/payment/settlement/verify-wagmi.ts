import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export const wagmiSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(_intent: SettlementIntent, txHash: string) {
    return TX_HASH_REGEX.test(txHash.trim());
  },
};
