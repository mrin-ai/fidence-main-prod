import type { UserDoc } from "@/lib/db/types";
import {
  invoiceFormDefaultValues,
  type InvoiceFormData,
} from "@/lib/invoice/schema";

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

  const wallet = input.user.walletAddresses[0];

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
    metadata: {
      ...invoiceFormDefaultValues.metadata,
      ...input.existing?.metadata,
      paymentInformation:
        (input.existing?.metadata.paymentInformation.length ?? 0) > 0
          ? input.existing!.metadata.paymentInformation
          : wallet
            ? [{ label: "Wallet", value: wallet }]
            : [],
    },
  };
}
