"use client";

import * as React from "react";
import { GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import { formatCurrency } from "@/lib/invoice/currency";
import {
  invoiceItemSchema,
  type InvoiceFormData,
  type InvoiceItem,
} from "@/lib/invoice/schema";

export function InvoiceItemsSection({
  form,
}: {
  form: UseFormReturn<InvoiceFormData>;
}) {
  const items = form.watch("items");
  const currency = form.watch("invoiceDetails.currency");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<InvoiceItem>({
    name: "",
    description: "",
    quantity: 1,
    unitPrice: 1,
  });

  function openCreate() {
    setEditingIndex(null);
    setDraft({ name: "", description: "", quantity: 1, unitPrice: 1 });
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setDraft(items[index]);
    setDialogOpen(true);
  }

  function saveItem() {
    const parsed = invoiceItemSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid item");
      return;
    }

    if (editingIndex === null) {
      form.setValue("items", [...items, parsed.data], { shouldDirty: true });
    } else {
      const next = [...items];
      next[editingIndex] = parsed.data;
      form.setValue("items", next, { shouldDirty: true });
    }

    setDialogOpen(false);
  }

  function removeItem(index: number) {
    form.setValue(
      "items",
      items.filter((_, rowIndex) => rowIndex !== index),
      { shouldDirty: true },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/20 p-3"
        >
          <GripVerticalIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.name}</p>
            {item.description ? (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatCurrency(item.unitPrice, currency)} × {item.quantity} qty
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="font-mono text-sm font-medium">
              {formatCurrency(item.quantity * item.unitPrice, currency)}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(index)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeItem(index)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" className="w-full" onClick={openCreate}>
        <PlusIcon data-icon="inline-start" />
        Add item
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIndex === null ? "Add item" : "Edit item"}</DialogTitle>
            <DialogDescription>
              Line items appear on the invoice and in the PDF preview.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <FieldContent>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </FieldContent>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Quantity</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.quantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        quantity: Number(event.target.value),
                      }))
                    }
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Unit price</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={draft.unitPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        unitPrice: Number(event.target.value),
                      }))
                    }
                  />
                </FieldContent>
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveItem}>
              {editingIndex === null ? "Add item" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
