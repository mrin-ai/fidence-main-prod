"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver, type UseFormReturn } from "react-hook-form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldContent } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceDatePicker } from "@/components/invoice/invoice-date-picker";
import {
  InvoiceBillingFieldRows,
  InvoiceImagePicker,
  InvoiceStringFieldRows,
} from "@/components/invoice/invoice-field-rows";
import {
  InvoiceFieldHint,
  InvoiceFieldLabel,
  InvoiceFormRow,
} from "@/components/invoice/invoice-form-field";
import { InvoiceItemsAndPaymentSection } from "@/components/invoice/invoice-items-and-payment-section";
import { currenciesWithSymbols } from "@/lib/invoice/currency";
import {
  invoiceFormDefaultValues,
  invoiceFormSchema,
  type InvoiceFormData,
} from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";

export function useInvoiceForm(defaultValues?: InvoiceFormData) {
  return useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema) as Resolver<InvoiceFormData>,
    defaultValues: defaultValues ?? invoiceFormDefaultValues,
    mode: "onChange",
  });
}

export function InvoiceFormPanel({
  form,
  savedPaymentLink,
}: {
  form: UseFormReturn<InvoiceFormData>;
  savedPaymentLink?: InvoicePaymentLinkInfo | null;
}) {
  const logoPreview =
    form.watch("companyDetails.logoBase64") ||
    form.watch("companyDetails.logo");
  const signaturePreview =
    form.watch("companyDetails.signatureBase64") ||
    form.watch("companyDetails.signature");
  return (
    <div className="flex h-full flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Accordion
        defaultValue={["company-details"]}
        className="w-full divide-y border-b"
      >
        <AccordionItem value="company-details">
          <AccordionTrigger className="px-4">Company Details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <InvoiceImagePicker
                label="Company Logo"
                previewUrl={logoPreview}
                onChange={(dataUrl) => {
                  form.setValue("companyDetails.logoBase64", dataUrl, {
                    shouldDirty: true,
                  });
                  form.setValue("companyDetails.logo", dataUrl, {
                    shouldDirty: true,
                  });
                }}
                onRemove={() => {
                  form.setValue("companyDetails.logo", "", { shouldDirty: true });
                  form.setValue("companyDetails.logoBase64", undefined, {
                    shouldDirty: true,
                  });
                }}
              />
              <InvoiceImagePicker
                label="Company Signature"
                previewUrl={signaturePreview}
                onChange={(dataUrl) => {
                  form.setValue("companyDetails.signatureBase64", dataUrl, {
                    shouldDirty: true,
                  });
                  form.setValue("companyDetails.signature", dataUrl, {
                    shouldDirty: true,
                  });
                }}
                onRemove={() => {
                  form.setValue("companyDetails.signature", "", {
                    shouldDirty: true,
                  });
                  form.setValue("companyDetails.signatureBase64", undefined, {
                    shouldDirty: true,
                  });
                }}
              />
            </div>
            <Field>
              <InvoiceFieldLabel>Company Name</InvoiceFieldLabel>
              <FieldContent>
                <Input
                  placeholder="John Doe ltd."
                  {...form.register("companyDetails.name")}
                />
                <InvoiceFieldHint>Name of your company</InvoiceFieldHint>
              </FieldContent>
            </Field>
            <Field>
              <InvoiceFieldLabel>Company Address</InvoiceFieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  placeholder="123 Business St, City, Country"
                  {...form.register("companyDetails.address")}
                />
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="companyDetails.metadata"
              label="Company Fields"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="client-details">
          <AccordionTrigger className="px-4">Client Details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <Field>
              <InvoiceFieldLabel>Client Name</InvoiceFieldLabel>
              <FieldContent>
                <Input
                  placeholder="John Doe"
                  {...form.register("clientDetails.name")}
                />
              </FieldContent>
            </Field>
            <Field>
              <InvoiceFieldLabel>Client Address</InvoiceFieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  placeholder="456 Client St, City, Country"
                  {...form.register("clientDetails.address")}
                />
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="clientDetails.metadata"
              label="Client Fields"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="invoice-details">
          <AccordionTrigger className="px-4">Invoice Details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <InvoiceFormRow>
              <Field className="min-w-0 flex-1">
                <InvoiceFieldLabel>Currency</InvoiceFieldLabel>
                <FieldContent>
                  <Select
                    value={form.watch("invoiceDetails.currency")}
                    onValueChange={(value) => {
                      if (!value) return;
                      form.setValue("invoiceDetails.currency", value, {
                        shouldDirty: true,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(currenciesWithSymbols).map(
                        ([key, symbol]) => (
                          <SelectItem key={key} value={key}>
                            <span>{key}</span>
                            <Badge className="rounded bg-primary/15 text-primary">
                              {symbol}
                            </Badge>
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <InvoiceFieldHint>
                    Currency code for the invoice
                  </InvoiceFieldHint>
                </FieldContent>
              </Field>
              <Field className="min-w-0 flex-1">
                <InvoiceFieldLabel optional>Invoice Prefix</InvoiceFieldLabel>
                <FieldContent>
                  <Input
                    placeholder="INV-"
                    {...form.register("invoiceDetails.prefix")}
                  />
                  <InvoiceFieldHint>Prefix for invoice number</InvoiceFieldHint>
                </FieldContent>
              </Field>
              <Field className="min-w-0 flex-1">
                <InvoiceFieldLabel>Serial Number</InvoiceFieldLabel>
                <FieldContent>
                  <Input
                    placeholder="0001"
                    {...form.register("invoiceDetails.serialNumber")}
                  />
                  <InvoiceFieldHint>Invoice serial number</InvoiceFieldHint>
                </FieldContent>
              </Field>
            </InvoiceFormRow>
            <InvoiceFormRow>
              <div className="min-w-0 flex-1">
                <InvoiceDatePicker
                  form={form}
                  name="invoiceDetails.date"
                  label="Invoice Date"
                  description="Date when invoice is issued"
                />
              </div>
              <div className="min-w-0 flex-1">
                <InvoiceDatePicker
                  form={form}
                  name="invoiceDetails.dueDate"
                  label="Due Date"
                  description="Date when payment is due"
                />
              </div>
            </InvoiceFormRow>
            <Field>
              <InvoiceFieldLabel optional>Payment Terms</InvoiceFieldLabel>
              <FieldContent>
                <Input
                  placeholder="50% of total amount upfront"
                  {...form.register("invoiceDetails.paymentTerms")}
                />
                <InvoiceFieldHint>Terms of payment</InvoiceFieldHint>
              </FieldContent>
            </Field>
            <InvoiceBillingFieldRows form={form} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="items-and-payment">
          <AccordionTrigger className="px-4">
            Items &amp; payment <span className="ml-1 text-destructive">*</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <InvoiceItemsAndPaymentSection
              form={form}
              savedPaymentLink={savedPaymentLink}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additional-info">
          <AccordionTrigger className="px-4">
            Additional Information
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <Field>
              <InvoiceFieldLabel optional>Notes</InvoiceFieldLabel>
              <FieldContent>
                <Textarea
                  placeholder="Notes - any relevant information not already covered"
                  {...form.register("metadata.notes")}
                />
                <InvoiceFieldHint>
                  Additional notes for the invoice
                </InvoiceFieldHint>
              </FieldContent>
            </Field>
            <Field>
              <InvoiceFieldLabel optional>Terms</InvoiceFieldLabel>
              <FieldContent>
                <Textarea
                  placeholder="Terms & Conditions - late fees, payment methods, delivery terms, etc."
                  {...form.register("metadata.terms")}
                />
                <InvoiceFieldHint>
                  Terms and conditions for the invoice
                </InvoiceFieldHint>
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="metadata.paymentInformation"
              label="Payment Information"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
