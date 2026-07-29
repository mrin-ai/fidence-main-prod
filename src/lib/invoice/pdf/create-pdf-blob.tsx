import { pdf } from "@react-pdf/renderer";

import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePdfPayment } from "@/lib/invoice/invoice-payment-link";

import { DefaultInvoicePdf } from "./default-template";
import { VercelInvoicePdf } from "./vercel-template";
import { registerInvoiceFonts } from "./register-fonts";

export async function createInvoicePdfBlob(
  data: InvoiceFormData,
  payment?: InvoicePdfPayment,
) {
  registerInvoiceFonts();
  const template = data.invoiceDetails.theme.template ?? "default";
  const document =
    template === "vercel" ? (
      <VercelInvoicePdf data={data} payment={payment} />
    ) : (
      <DefaultInvoicePdf data={data} payment={payment} />
    );
  return pdf(document).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
