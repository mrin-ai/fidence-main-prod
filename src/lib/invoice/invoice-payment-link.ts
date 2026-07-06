import type { InvoiceFormData } from "@/lib/invoice/schema";

export type InvoicePaymentLinkInfo = {
  id: string;
  publicId: string;
  url: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  amount: number;
  tokenId: string;
  networkId: string;
};

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
