import type { InvoiceFormData } from "@/lib/invoice/schema";

export function calculateSubtotal(items: InvoiceFormData["items"]) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function calculateBillingAdjustments(
  subtotal: number,
  billingDetails: InvoiceFormData["invoiceDetails"]["billingDetails"],
) {
  let total = subtotal;

  for (const row of billingDetails) {
    if (row.type === "percentage") {
      total += subtotal * (row.value / 100);
    } else {
      total += row.value;
    }
  }

  return total;
}

export function calculateInvoiceTotal(data: InvoiceFormData) {
  const subtotal = calculateSubtotal(data.items);
  return calculateBillingAdjustments(subtotal, data.invoiceDetails.billingDetails);
}
