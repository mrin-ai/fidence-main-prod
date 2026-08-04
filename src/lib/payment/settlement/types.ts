export type SettlementIntent = {
  recipientAddress: string;
  amount: number;
  tokenId: string;
  networkId: string;
  payerAddress: string;
};

export type SettlementVerifyResult =
  | { ok: false }
  | { ok: true; observedAmount: number };

export interface PaymentSettlementVerifier {
  verifySettlement(intent: SettlementIntent, txHash: string): Promise<boolean>;
  verifySettlementDetailed(
    intent: SettlementIntent,
    txHash: string,
  ): Promise<SettlementVerifyResult>;
}
