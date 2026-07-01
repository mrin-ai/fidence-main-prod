import { pdf } from "@react-pdf/renderer";

import type { InvoiceFormData } from "@/lib/invoice/schema";

import { DefaultInvoicePdf } from "./default-template";

export async function createInvoicePdfBlob(data: InvoiceFormData) {
  return pdf(<DefaultInvoicePdf data={data} />).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
