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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/invoice/currency";
import {
  invoiceItemSchema,
  type InvoiceFormData,
  type InvoiceItem,
} from "@/lib/invoice/schema";

const emptyItem: InvoiceItem = {
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 1,
};

export function InvoiceItemsSection({
  form,
}: {
  form: UseFormReturn<InvoiceFormData>;
}) {
  const items = form.watch("items");
  const currency = form.watch("invoiceDetails.currency");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<InvoiceItem>(emptyItem);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  const lineTotal = draft.quantity * draft.unitPrice;
  const isEditing = editingIndex !== null;

  function openCreate() {
    setEditingIndex(null);
    setDraft(emptyItem);
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setDraft(items[index]);
    setDialogOpen(true);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingIndex(null);
      setDraft(emptyItem);
    }
  }

  React.useEffect(() => {
    if (!dialogOpen) return;
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [dialogOpen, editingIndex]);

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

    handleDialogChange(false);
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

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle>{isEditing ? "Edit item" : "Add item"}</DialogTitle>
            <DialogDescription>
              Line items appear on the invoice and in the PDF preview.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              saveItem();
            }}
          >
            <div className="flex max-h-[min(28rem,calc(100vh-16rem))] flex-col gap-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="invoice-item-name">Name</Label>
                <Input
                  ref={nameInputRef}
                  id="invoice-item-name"
                  placeholder="Consulting services"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-item-description">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="invoice-item-description"
                  placeholder="Add details that should appear below the item name"
                  rows={3}
                  className="min-h-20 resize-none"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="invoice-item-quantity">Quantity</Label>
                  <Input
                    id="invoice-item-quantity"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        quantity: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-item-unit-price">Unit price</Label>
                  <Input
                    id="invoice-item-unit-price"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.unitPrice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        unitPrice: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Line total
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(lineTotal, currency)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-24"
                  onClick={() => handleDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="sm:min-w-32">
                  {isEditing ? "Save changes" : "Add item"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
