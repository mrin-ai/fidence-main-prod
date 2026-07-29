import { z } from "zod";

import { isPaymentTokenNetworkSupported } from "@/lib/create-payment-link-data";

export const valueTypeSchema = z.enum(["percentage", "fixed"]);

export const invoiceFieldRowSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.string().min(1, "Value is required"),
});

export const billingDetailRowSchema = z.object({
  label: z.string().min(1, "Label is required"),
  value: z.coerce.number(),
  type: valueTypeSchema,
});

export const invoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitPrice: z.coerce.number().positive("Unit price must be positive"),
});

export const invoiceThemeSchema = z.object({
  baseColor: z.string().min(1),
  mode: z.enum(["dark", "light"]),
  template: z.enum(["default", "vercel"]).optional(),
  font: z.enum(["inter", "geist"]).optional(),
});

const invoiceFormBaseSchema = z.object({
  companyDetails: z.object({
    logo: z.string().nullable().optional(),
    logoBase64: z.string().optional(),
    signature: z.string().nullable().optional(),
    signatureBase64: z.string().optional(),
    name: z.string().min(1, "Company name is required"),
    address: z.string(),
    metadata: z.array(invoiceFieldRowSchema),
  }),
  clientDetails: z.object({
    name: z.string().min(1, "Client name is required"),
    address: z.string(),
    metadata: z.array(invoiceFieldRowSchema),
  }),
  invoiceDetails: z.object({
    theme: invoiceThemeSchema,
    currency: z.string().min(1),
    prefix: z.string(),
    serialNumber: z.string().min(1, "Serial number is required"),
    date: z.coerce.date(),
    dueDate: z.coerce.date().nullable().optional(),
    paymentTerms: z.string(),
    billingDetails: z.array(billingDetailRowSchema),
  }),
  items: z.array(invoiceItemSchema),
  metadata: z.object({
    notes: z.string(),
    terms: z.string(),
    paymentInformation: z.array(invoiceFieldRowSchema),
  }),
  paymentLink: z.object({
    tokenId: z.string(),
    networkId: z.string(),
  }),
});

/** Used for live PDF preview — payment link and line items are not required yet. */
export const invoicePdfSchema = invoiceFormBaseSchema;

export const invoiceFormSchema = invoiceFormBaseSchema
  .extend({
    paymentLink: z.object({
      tokenId: z.string().min(1, "Token is required"),
      networkId: z.string().min(1, "Network is required"),
    }),
  })
  .superRefine((data, context) => {
  if (
    !isPaymentTokenNetworkSupported(
      data.paymentLink.tokenId,
      data.paymentLink.networkId,
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selected network does not support this token",
      path: ["paymentLink", "networkId"],
    });
  }

  if (data.items.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add at least one invoice item before saving",
      path: ["items"],
    });
  }
});

export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;
export type InvoiceItem = InvoiceFormData["items"][number];

export const invoiceFormDefaultValues: InvoiceFormData = {
  companyDetails: {
    name: "Your Company",
    address: "",
    metadata: [],
  },
  clientDetails: {
    name: "Client Name",
    address: "",
    metadata: [],
  },
  invoiceDetails: {
    theme: {
      baseColor: "#2b6bff",
      mode: "light",
      template: "default",
      font: "geist",
    },
    currency: "USD",
    prefix: "INV-",
    serialNumber: "0001",
    date: new Date(),
    dueDate: null,
    paymentTerms: "",
    billingDetails: [],
  },
  items: [],
  metadata: {
    notes: "",
    terms: "",
    paymentInformation: [],
  },
  paymentLink: {
    tokenId: "usdc",
    networkId: "base",
  },
};

export function coerceInvoicePreviewData(value: unknown): InvoiceFormData {
  const defaults = invoiceFormDefaultValues;
  const input =
    value && typeof value === "object"
      ? (value as Partial<InvoiceFormData>)
      : {};

  function coerceDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
  }

  function validFieldRows(
    rows: Array<{ label?: string; value?: string }> | undefined,
  ) {
    return (rows ?? []).filter(
      (row): row is { label: string; value: string } =>
        Boolean(row?.label?.trim()) && Boolean(row?.value?.trim()),
    );
  }

  function validItems(items: InvoiceFormData["items"] | undefined) {
    return (items ?? []).filter(
      (item) =>
        Boolean(item?.name?.trim()) &&
        Number(item.quantity) > 0 &&
        Number(item.unitPrice) > 0,
    );
  }

  function validBillingRows(
    rows: InvoiceFormData["invoiceDetails"]["billingDetails"] | undefined,
  ) {
    return (rows ?? []).filter(
      (row) => Boolean(row?.label?.trim()) && Number.isFinite(Number(row.value)),
    );
  }

  const invoiceDate =
    coerceDate(input.invoiceDetails?.date) ?? defaults.invoiceDetails.date;
  const dueDateRaw = input.invoiceDetails?.dueDate;
  const dueDate =
    dueDateRaw == null
      ? null
      : (coerceDate(dueDateRaw) ?? null);

  return {
    companyDetails: {
      ...defaults.companyDetails,
      ...input.companyDetails,
      logo:
        input.companyDetails?.logo ||
        input.companyDetails?.logoBase64 ||
        defaults.companyDetails.logo,
      logoBase64:
        input.companyDetails?.logoBase64 ||
        input.companyDetails?.logo ||
        undefined,
      signature:
        input.companyDetails?.signature ||
        input.companyDetails?.signatureBase64 ||
        defaults.companyDetails.signature,
      signatureBase64:
        input.companyDetails?.signatureBase64 ||
        input.companyDetails?.signature ||
        undefined,
      name: input.companyDetails?.name?.trim() || defaults.companyDetails.name,
      address: input.companyDetails?.address ?? defaults.companyDetails.address,
      metadata: validFieldRows(input.companyDetails?.metadata),
    },
    clientDetails: {
      ...defaults.clientDetails,
      ...input.clientDetails,
      name: input.clientDetails?.name?.trim() || defaults.clientDetails.name,
      address: input.clientDetails?.address ?? defaults.clientDetails.address,
      metadata: validFieldRows(input.clientDetails?.metadata),
    },
    invoiceDetails: {
      ...defaults.invoiceDetails,
      ...input.invoiceDetails,
      theme: {
        ...defaults.invoiceDetails.theme,
        ...input.invoiceDetails?.theme,
      },
      currency:
        input.invoiceDetails?.currency?.trim() ||
        defaults.invoiceDetails.currency,
      prefix: input.invoiceDetails?.prefix ?? defaults.invoiceDetails.prefix,
      serialNumber:
        input.invoiceDetails?.serialNumber?.trim() ||
        defaults.invoiceDetails.serialNumber,
      date: invoiceDate,
      dueDate,
      paymentTerms:
        input.invoiceDetails?.paymentTerms ??
        defaults.invoiceDetails.paymentTerms,
      billingDetails: validBillingRows(input.invoiceDetails?.billingDetails),
    },
    items: validItems(input.items),
    metadata: {
      notes: input.metadata?.notes ?? defaults.metadata.notes,
      terms: input.metadata?.terms ?? defaults.metadata.terms,
      paymentInformation: validFieldRows(input.metadata?.paymentInformation),
    },
    paymentLink: {
      tokenId: input.paymentLink?.tokenId || defaults.paymentLink.tokenId,
      networkId: input.paymentLink?.networkId || defaults.paymentLink.networkId,
    },
  };
}

export function invoiceReference(data: InvoiceFormData) {
  return `${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`.trim();
}
