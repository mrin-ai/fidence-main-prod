import type { InvoiceFormData } from "@/lib/invoice/schema";
import { getNetworkById, getTokenById } from "@/lib/create-payment-link-data";

export type InvoicePaymentLinkInfo = {
  id: string;
  publicId: string;
  url: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  amount: number;
  tokenId: string;
  networkId: string;
};

export type InvoicePdfPayment = {
  url: string;
  amount: number;
  tokenSymbol: string;
  networkLabel: string;
  status: InvoicePaymentLinkInfo["status"];
};

export function paymentLinkToPdfPayment(
  paymentLink: InvoicePaymentLinkInfo,
): InvoicePdfPayment {
  const token = getTokenById(paymentLink.tokenId);
  const network = getNetworkById(paymentLink.networkId);

  return {
    url: paymentLink.url,
    amount: paymentLink.amount,
    tokenSymbol: token?.symbol ?? paymentLink.tokenId.toUpperCase(),
    networkLabel: network?.label ?? paymentLink.networkId,
    status: paymentLink.status,
  };
}

export function resolveInvoicePaymentExpiry(data: InvoiceFormData) {
  if (data.invoiceDetails.dueDate) {
    const dueDate = new Date(data.invoiceDetails.dueDate);
    dueDate.setHours(23, 59, 59, 999);
    return dueDate;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  return expiresAt;
}
