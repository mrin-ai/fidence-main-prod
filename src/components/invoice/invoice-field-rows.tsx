"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvoiceFormData } from "@/lib/invoice/schema";

type StringFieldName =
  | "companyDetails.metadata"
  | "clientDetails.metadata"
  | "metadata.paymentInformation";

export function InvoiceStringFieldRows({
  form,
  name,
  label,
}: {
  form: UseFormReturn<InvoiceFormData>;
  name: StringFieldName;
  label: string;
}) {
  const rows = form.watch(name);

  function appendRow() {
    form.setValue(name, [...rows, { label: "", value: "" }], {
      shouldDirty: true,
    });
  }

  function removeRow(index: number) {
    form.setValue(
      name,
      rows.filter((_, rowIndex) => rowIndex !== index),
      { shouldDirty: true },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      {rows.map((row, index) => (
        <div key={`${name}-${index}`} className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel className="text-xs">Label</FieldLabel>
            <FieldContent>
              <Input
                value={row.label}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...next[index], label: event.target.value };
                  form.setValue(name, next, { shouldDirty: true });
                }}
                placeholder="Label"
              />
            </FieldContent>
          </Field>
          <Field className="flex-1">
            <FieldLabel className="text-xs">Value</FieldLabel>
            <FieldContent>
              <Input
                value={row.value}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...next[index], value: event.target.value };
                  form.setValue(name, next, { shouldDirty: true });
                }}
                placeholder="Value"
              />
            </FieldContent>
          </Field>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="mb-0.5 shrink-0"
            onClick={() => removeRow(index)}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={appendRow}
      >
        <PlusIcon data-icon="inline-start" />
        Add field
      </Button>
    </div>
  );
}

export function InvoiceBillingFieldRows({
  form,
}: {
  form: UseFormReturn<InvoiceFormData>;
}) {
  const name = "invoiceDetails.billingDetails" as const;
  const rows = form.watch(name);

  function appendRow() {
    form.setValue(
      name,
      [...rows, { label: "Tax", value: 0, type: "percentage" as const }],
      { shouldDirty: true },
    );
  }

  function removeRow(index: number) {
    form.setValue(
      name,
      rows.filter((_, rowIndex) => rowIndex !== index),
      { shouldDirty: true },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Billing details</FieldLabel>
      {rows.map((row, index) => (
        <div key={`billing-${index}`} className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel className="text-xs">Label</FieldLabel>
            <FieldContent>
              <Input
                value={row.label}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...next[index], label: event.target.value };
                  form.setValue(name, next, { shouldDirty: true });
                }}
              />
            </FieldContent>
          </Field>
          <Field className="w-28">
            <FieldLabel className="text-xs">Type</FieldLabel>
            <FieldContent>
              <Select
                value={row.type}
                onValueChange={(value) => {
                  if (!value) return;
                  const next = [...rows];
                  next[index] = {
                    ...next[index],
                    type: value as "fixed" | "percentage",
                  };
                  form.setValue(name, next, { shouldDirty: true });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <Field className="w-28">
            <FieldLabel className="text-xs">Value</FieldLabel>
            <FieldContent>
              <Input
                type="number"
                value={row.value}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = {
                    ...next[index],
                    value: Number(event.target.value),
                  };
                  form.setValue(name, next, { shouldDirty: true });
                }}
              />
            </FieldContent>
          </Field>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="mb-0.5 shrink-0"
            onClick={() => removeRow(index)}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={appendRow}
      >
        <PlusIcon data-icon="inline-start" />
        Add billing row
      </Button>
    </div>
  );
}

export function InvoiceImagePicker({
  label,
  previewUrl,
  onChange,
  onRemove,
}: {
  label: string;
  previewUrl?: string | null;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-40">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-secondary/20 text-xs text-muted-foreground transition-colors hover:bg-secondary/40"
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="max-h-20 max-w-full object-contain"
          />
        ) : (
          <span>Upload image</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {previewUrl ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}
