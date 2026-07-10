import type { UserDoc } from "@/lib/db/types";
import {
  invoiceFormDefaultValues,
  type InvoiceFormData,
} from "@/lib/invoice/schema";

const defaultPreviewItems: InvoiceFormData["items"] = [
  {
    name: "Professional services",
    description: "Consulting and implementation",
    quantity: 1,
    unitPrice: 100,
  },
];

export function buildInvoiceDefaults(input: {
  user: UserDoc;
  serialNumber: string;
  existing?: InvoiceFormData;
}): InvoiceFormData {
  const profile = input.user.profile;
  const companyName =
    profile?.company?.trim() ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    input.user.name;

  const companyAddress = [
    profile?.phone ? `Phone: ${profile.phone}` : null,
    input.user.email ? `Email: ${input.user.email}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ...invoiceFormDefaultValues,
    ...input.existing,
    companyDetails: {
      ...invoiceFormDefaultValues.companyDetails,
      ...input.existing?.companyDetails,
      name: input.existing?.companyDetails.name || companyName,
      address: input.existing?.companyDetails.address || companyAddress,
    },
    invoiceDetails: {
      ...invoiceFormDefaultValues.invoiceDetails,
      ...input.existing?.invoiceDetails,
      serialNumber: input.serialNumber,
      date: input.existing?.invoiceDetails.date ?? new Date(),
    },
    items:
      input.existing?.items && input.existing.items.length > 0
        ? input.existing.items
        : defaultPreviewItems,
    paymentLink: {
      ...invoiceFormDefaultValues.paymentLink,
      ...input.existing?.paymentLink,
    },
    metadata: {
      ...invoiceFormDefaultValues.metadata,
      ...input.existing?.metadata,
      paymentInformation:
        input.existing?.metadata.paymentInformation ?? [],
    },
  };
}
