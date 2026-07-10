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

import { downloadInvoicePdf } from "@/components/invoice/invoice-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import type { InvoiceStatus } from "@/lib/db/types";
import {
  invoiceFormSchema,
  type InvoiceFormData,
} from "@/lib/invoice/schema";

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function InvoiceToolbar({
  form,
  invoiceId,
  invoiceStatus,
  paymentLink,
  onSaved,
}: {
  form: UseFormReturn<InvoiceFormData>;
  invoiceId?: string;
  invoiceStatus?: InvoiceStatus;
  paymentLink?: InvoicePaymentLinkInfo | null;
  onSaved?: (payload: {
    id: string;
    status?: InvoiceStatus;
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
        code?: string;
        id?: string;
        reference?: string;
        status?: InvoiceStatus;
        paymentLink?: InvoicePaymentLinkInfo;
      };

      if (!response.ok) {
        if (payload.code === "WALLET_NOT_VERIFIED_FOR_NETWORK") {
          toast.error(payload.error ?? "Add a verified wallet for this network", {
            action: {
              label: "Wallets",
              onClick: () => router.push("/wallets"),
            },
          });
          return;
        }
        throw new Error(payload.error ?? "Failed to save invoice");
      }

      toast.success(`Saved ${payload.reference ?? "invoice"}`);

      const savedId = payload.id ?? invoiceId;
      if (savedId) {
        onSaved?.({
          id: savedId,
          status: payload.status,
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

  async function handleViewPdf() {
    try {
      await downloadInvoicePdf(form, paymentLink);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open PDF");
    }
  }

  const displayStatus = paymentLink?.status === "paid" ? "paid" : invoiceStatus;

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-muted-foreground">
          {invoiceId ? "Edit invoice" : "Create invoice"}
        </span>
        {displayStatus ? (
          <Badge
            variant={displayStatus === "paid" ? "default" : "secondary"}
            className="shrink-0"
          >
            {statusLabel[displayStatus]}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
