import type { InvoiceFormData } from "@/lib/invoice/schema";

export type SerializedInvoiceFormData = Omit<
  InvoiceFormData,
  "invoiceDetails"
> & {
  invoiceDetails: Omit<InvoiceFormData["invoiceDetails"], "date" | "dueDate"> & {
    date: string;
    dueDate: string | null;
  };
};

export function serializeInvoiceForm(data: InvoiceFormData): SerializedInvoiceFormData {
  return {
    ...data,
    invoiceDetails: {
      ...data.invoiceDetails,
      date: data.invoiceDetails.date.toISOString(),
      dueDate: data.invoiceDetails.dueDate
        ? data.invoiceDetails.dueDate.toISOString()
        : null,
    },
  };
}

export function deserializeInvoiceForm(
  data: SerializedInvoiceFormData,
): InvoiceFormData {
  return {
    ...data,
    invoiceDetails: {
      ...data.invoiceDetails,
      date: new Date(data.invoiceDetails.date),
      dueDate: data.invoiceDetails.dueDate
        ? new Date(data.invoiceDetails.dueDate)
        : null,
    },
  };
}
