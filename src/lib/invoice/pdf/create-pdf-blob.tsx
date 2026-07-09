import { pdf } from "@react-pdf/renderer";

import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePdfPayment } from "@/lib/invoice/invoice-payment-link";

import { DefaultInvoicePdf } from "./default-template";
import { registerInvoiceFonts } from "./register-fonts";

export async function createInvoicePdfBlob(
  data: InvoiceFormData,
  payment?: InvoicePdfPayment,
) {
  registerInvoiceFonts();
  return pdf(<DefaultInvoicePdf data={data} payment={payment} />).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
