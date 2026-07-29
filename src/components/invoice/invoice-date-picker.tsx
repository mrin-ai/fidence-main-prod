"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Field, FieldContent } from "@/components/ui/field";
import {
  InvoiceFieldHint,
  InvoiceFieldLabel,
} from "@/components/invoice/invoice-form-field";
import { cn } from "@/lib/utils";
import type { InvoiceFormData } from "@/lib/invoice/schema";

export function InvoiceDatePicker({
  form,
  name,
  label,
  description,
}: {
  form: UseFormReturn<InvoiceFormData>;
  name: "invoiceDetails.date" | "invoiceDetails.dueDate";
  label: string;
  description?: string;
}) {
  const value = form.watch(name);

  return (
    <Field>
      <InvoiceFieldLabel>{label}</InvoiceFieldLabel>
      <FieldContent>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground",
                )}
              />
            }
          >
            <CalendarIcon className="size-4" />
            {value ? format(value, "PPP") : "Pick a date"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ?? undefined}
              onSelect={(date) => {
                form.setValue(name, date ?? null, { shouldDirty: true });
              }}
            />
          </PopoverContent>
        </Popover>
        {description ? (
          <InvoiceFieldHint>{description}</InvoiceFieldHint>
        ) : null}
      </FieldContent>
    </Field>
  );
}
