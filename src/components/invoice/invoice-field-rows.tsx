"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
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
        Add New Field
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
      [...rows, { label: "", value: 0, type: "fixed" as const }],
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
      <FieldLabel>Billing Details</FieldLabel>
      {rows.map((row, index) => (
        <div
          key={`billing-${index}`}
          className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex w-full flex-row gap-2 sm:w-2/3">
            <Field className="flex-1">
              <FieldLabel className="flex items-center gap-1.5 text-xs">
                Label
                <Badge
                  variant="secondary"
                  className="h-4 rounded px-1.5 text-[10px] font-medium"
                >
                  Tax/Discount/Other
                </Badge>
              </FieldLabel>
              <FieldContent>
                <Input
                  placeholder="Label"
                  value={row.label}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...next[index], label: event.target.value };
                    form.setValue(name, next, { shouldDirty: true });
                  }}
                />
              </FieldContent>
            </Field>
            <Field className="w-36">
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
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </div>
          <div className="flex w-full flex-row items-end gap-2 sm:w-1/3">
            <Field className="flex-1">
              <FieldLabel className="text-xs">Value</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  placeholder="Value"
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
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={appendRow}
      >
        Add New Field
      </Button>
    </div>
  );
}

/** Convert uploads to PNG data URLs so @react-pdf can render them reliably. */
async function fileToPngDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to load image"));
      element.src = objectUrl;
    });

    const maxEdge = 1024;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not process image");
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

  async function handleFile(file: File) {
    try {
      const dataUrl = await fileToPngDataUrl(file);
      onChange(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onChange(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
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
          if (file) void handleFile(file);
          event.target.value = "";
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
