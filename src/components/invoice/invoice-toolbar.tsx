"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  SaveIcon,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { InvoiceTabSwitch, type InvoiceViewTab } from "@/components/invoice/invoice-tab-switch";
import { downloadInvoicePdf } from "@/components/invoice/invoice-preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import {
  invoiceFormSchema,
  type InvoiceFormData,
} from "@/lib/invoice/schema";

export function InvoiceToolbar({
  form,
  viewTab,
  onViewTabChange,
  invoiceId,
  onSaved,
}: {
  form: UseFormReturn<InvoiceFormData>;
  viewTab: InvoiceViewTab;
  onViewTabChange: (tab: InvoiceViewTab) => void;
  invoiceId?: string;
  onSaved?: (payload: {
    id: string;
    paymentLink?: InvoicePaymentLinkInfo;
  }) => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);

  async function saveInvoice() {
    const parsed = invoiceFormSchema.safeParse(form.getValues());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid invoice");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices",
        {
          method: invoiceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        id?: string;
        reference?: string;
        paymentLink?: InvoicePaymentLinkInfo;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save invoice");
      }

      toast.success(`Saved ${payload.reference ?? "invoice"}`);

      const savedId = payload.id ?? invoiceId;
      if (savedId) {
        onSaved?.({
          id: savedId,
          paymentLink: payload.paymentLink,
        });
      }

      if (!invoiceId && payload.id) {
        router.replace(`/invoice/${payload.id}`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save invoice");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload() {
    try {
      await downloadInvoicePdf(form);
      await saveInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download PDF");
    }
  }

  async function handleViewPdf() {
    try {
      await downloadInvoicePdf(form);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open PDF");
    }
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
      <div className="text-sm text-muted-foreground">
        {invoiceId ? "Edit invoice" : "Create invoice"}
      </div>
      <div className="flex items-center gap-2">
        <InvoiceTabSwitch value={viewTab} onChange={onViewTabChange} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="sm" disabled={isSaving} />}
          >
            {isSaving ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            Download
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void saveInvoice()}>
              <SaveIcon className="size-4" />
              Save invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleViewPdf()}>
              <EyeIcon className="size-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleDownload()}>
              <DownloadIcon className="size-4" />
              Save & download PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
