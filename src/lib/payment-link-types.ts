import type { PaymentLinkStatus } from "@/lib/db/types";

export type PublicPaymentLink = {
  username: string;
  publicId: string;
  url: string;
  amount: number;
  tokenId: string;
  tokenSymbol: string;
  networkId: string;
  networkLabel: string;
  status: PaymentLinkStatus;
  expiresAt: string;
  expiresAtLabel: string;
  paidAt?: string;
  paidAtLabel?: string;
  paidBy?: string;
  paidTxHash?: string;
  recipientAddress?: string;
  merchantName: string;
  canPay: boolean;
  invoiceReference?: string;
};
