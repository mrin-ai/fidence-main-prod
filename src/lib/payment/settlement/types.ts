export type SettlementIntent = {
  recipientAddress: string;
  amount: number;
  tokenId: string;
  networkId: string;
  payerAddress: string;
};

export interface PaymentSettlementVerifier {
  verifySettlement(intent: SettlementIntent, txHash: string): Promise<boolean>;
}
