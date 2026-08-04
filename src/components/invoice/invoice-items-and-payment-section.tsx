"use client";

import type { UseFormReturn } from "react-hook-form";

import { InvoiceItemsSection } from "@/components/invoice/invoice-items-section";
import { InvoicePaymentLinkSection } from "@/components/invoice/invoice-payment-link-section";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";

export function InvoiceItemsAndPaymentSection({
  form,
  savedPaymentLink,
}: {
  form: UseFormReturn<InvoiceFormData>;
  savedPaymentLink?: InvoicePaymentLinkInfo | null;
}) {
  return (
    <div className="space-y-0">
      <InvoiceItemsSection form={form} />
      <InvoicePaymentLinkSection
        form={form}
        savedPaymentLink={savedPaymentLink}
      />
    </div>
  );
}
