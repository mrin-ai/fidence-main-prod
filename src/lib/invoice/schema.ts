import { z } from "zod";

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

export const invoiceFormSchema = z.object({
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
      font: "inter",
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
};

export function invoiceReference(data: InvoiceFormData) {
  return `${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`.trim();
}
