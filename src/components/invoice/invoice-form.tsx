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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
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
import { InvoiceItemsSection } from "@/components/invoice/invoice-items-section";
import { InvoicePaymentLinkSection } from "@/components/invoice/invoice-payment-link-section";
import { currenciesWithSymbols } from "@/lib/invoice/currency";
import {
  invoiceFormDefaultValues,
  invoiceFormSchema,
  type InvoiceFormData,
} from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import { cn } from "@/lib/utils";

function FormRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>
  );
}

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
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4">
        <span className="text-sm font-medium">Invoice template</span>
        <div className="flex items-center gap-2">
          <Select
            value={form.watch("invoiceDetails.theme.template") ?? "default"}
            onValueChange={(value) => {
              if (!value) return;
              form.setValue(
                "invoiceDetails.theme.template",
                value as "default" | "vercel",
                { shouldDirty: true },
              );
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="vercel">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Accordion defaultValue={["company-details"]} className="w-full divide-y border-b">
        <AccordionItem value="company-details">
          <AccordionTrigger className="px-4">Company details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <InvoiceImagePicker
                label="Company logo"
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
                label="Signature"
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
              <FieldLabel>Company name</FieldLabel>
              <FieldContent>
                <Input {...form.register("companyDetails.name")} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Company address</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  {...form.register("companyDetails.address")}
                />
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="companyDetails.metadata"
              label="Company fields"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="client-details">
          <AccordionTrigger className="px-4">Client details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <Field>
              <FieldLabel>Client name</FieldLabel>
              <FieldContent>
                <Input {...form.register("clientDetails.name")} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Client address</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  {...form.register("clientDetails.address")}
                />
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="clientDetails.metadata"
              label="Client fields"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="invoice-details">
          <AccordionTrigger className="px-4">Invoice details</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <FormRow>
              <Field>
                <FieldLabel>Currency</FieldLabel>
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
                      {Object.entries(currenciesWithSymbols).map(([key, symbol]) => (
                        <SelectItem key={key} value={key}>
                          <span>{key}</span>
                          <Badge variant="secondary" className="ml-2">
                            {symbol}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Currency for amounts on this invoice</FieldDescription>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Theme mode</FieldLabel>
                <FieldContent>
                  <Select
                    value={form.watch("invoiceDetails.theme.mode")}
                    onValueChange={(value) => {
                      if (!value) return;
                      form.setValue(
                        "invoiceDetails.theme.mode",
                        value as "dark" | "light",
                        { shouldDirty: true },
                      );
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </FormRow>
            <Field>
              <FieldLabel>Theme color</FieldLabel>
              <FieldContent>
                <Input
                  type="color"
                  className="h-10 w-full cursor-pointer p-1"
                  value={form.watch("invoiceDetails.theme.baseColor")}
                  onChange={(event) =>
                    form.setValue(
                      "invoiceDetails.theme.baseColor",
                      event.target.value,
                      { shouldDirty: true },
                    )
                  }
                />
              </FieldContent>
            </Field>
            <FormRow>
              <Field>
                <FieldLabel>Invoice prefix</FieldLabel>
                <FieldContent>
                  <Input {...form.register("invoiceDetails.prefix")} />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Serial number</FieldLabel>
                <FieldContent>
                  <Input {...form.register("invoiceDetails.serialNumber")} />
                </FieldContent>
              </Field>
            </FormRow>
            <FormRow>
              <InvoiceDatePicker
                form={form}
                name="invoiceDetails.date"
                label="Invoice date"
              />
              <InvoiceDatePicker
                form={form}
                name="invoiceDetails.dueDate"
                label="Due date"
              />
            </FormRow>
            <Field>
              <FieldLabel>Payment terms</FieldLabel>
              <FieldContent>
                <Input {...form.register("invoiceDetails.paymentTerms")} />
              </FieldContent>
            </Field>
            <InvoiceBillingFieldRows form={form} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="invoice-items">
          <AccordionTrigger className="px-4">Invoice items</AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <InvoiceItemsSection form={form} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additional-info">
          <AccordionTrigger className="px-4">Additional information</AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <FieldContent>
                <Textarea {...form.register("metadata.notes")} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Terms</FieldLabel>
              <FieldContent>
                <Textarea {...form.register("metadata.terms")} />
              </FieldContent>
            </Field>
            <InvoiceStringFieldRows
              form={form}
              name="metadata.paymentInformation"
              label="Payment information"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="payment-link">
          <AccordionTrigger className="px-4">
            Payment link <span className="ml-1 text-destructive">*</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <InvoicePaymentLinkSection
              form={form}
              savedPaymentLink={savedPaymentLink}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
