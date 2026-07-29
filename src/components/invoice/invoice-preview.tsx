"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createInvoicePdfBlob,
  downloadBlob,
} from "@/lib/invoice/pdf/create-pdf-blob";
import {
  paymentLinkToPdfPayment,
  type InvoicePaymentLinkInfo,
} from "@/lib/invoice/invoice-payment-link";
import {
  coerceInvoicePreviewData,
  type InvoiceFormData,
} from "@/lib/invoice/schema";
import { invoiceReference, invoiceFormSchema } from "@/lib/invoice/schema";

function InvoicePreviewSkeleton({ message }: { message: string }) {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-6">
      <Skeleton className="h-[720px] w-full max-w-[520px]" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

const InvoicePdfViewer = dynamic(
  () =>
    import("@/components/invoice/invoice-pdf-viewer").then(
      (mod) => mod.InvoicePdfViewer,
    ),
  {
    ssr: false,
    loading: () => <InvoicePreviewSkeleton message="Loading preview…" />,
  },
);

export function InvoicePreviewPanel({
  form,
  paymentLink,
}: {
  form: UseFormReturn<InvoiceFormData>;
  paymentLink?: InvoicePaymentLinkInfo | null;
}) {
  const [previewData, setPreviewData] = React.useState<InvoiceFormData | null>(
    null,
  );
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(true);
  const [isDownloading, setIsDownloading] = React.useState(false);

  async function handleDownloadPdf() {
    setIsDownloading(true);
    try {
      await downloadInvoicePdf(form, paymentLink);
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download PDF",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    async function generatePreview(value: unknown) {
      const previewData = coerceInvoicePreviewData(value);
      const pdfPayment = paymentLink
        ? paymentLinkToPdfPayment(paymentLink)
        : undefined;

      if (!cancelled) {
        setPreviewData(previewData);
        setError(null);
        setIsGenerating(true);
      }

      try {
        const blob = await createInvoicePdfBlob(previewData, pdfPayment);
        const nextUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPdfUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return nextUrl;
          });
          setIsGenerating(false);
        } else {
          URL.revokeObjectURL(nextUrl);
        }
      } catch (generationError) {
        if (!cancelled) {
          setError(
            generationError instanceof Error
              ? generationError.message
              : "Failed to generate PDF preview",
          );
          setIsGenerating(false);
        }
      }
    }

    void generatePreview(form.getValues());

    const subscription = form.watch(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void generatePreview(form.getValues());
      }, 900);
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [form, paymentLink]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  let content: React.ReactNode;

  if (error) {
    content = (
      <div className="flex min-h-full w-full items-center justify-center p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  } else if (isGenerating || !pdfUrl || !previewData) {
    content = (
      <InvoicePreviewSkeleton
        message={isGenerating ? "Generating preview…" : "Loading preview…"}
      />
    );
  } else {
    content = <InvoicePdfViewer url={pdfUrl} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/80 px-3">
        <span className="text-sm text-muted-foreground">Preview</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDownloading || isGenerating}
          onClick={() => void handleDownloadPdf()}
        >
          {isDownloading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
          Download PDF
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
        {content}
      </div>
    </div>
  );
}

export async function downloadInvoicePdf(
  form: UseFormReturn<InvoiceFormData>,
  paymentLink?: InvoicePaymentLinkInfo | null,
) {
  const previewData = coerceInvoicePreviewData(form.getValues());
  const saveParsed = invoiceFormSchema.safeParse(form.getValues());
  if (!saveParsed.success) {
    throw new Error(
      saveParsed.error.issues[0]?.message ?? "Fix form errors before downloading",
    );
  }

  const blob = await createInvoicePdfBlob(
    previewData,
    paymentLink ? paymentLinkToPdfPayment(paymentLink) : undefined,
  );
  downloadBlob(blob, `${invoiceReference(previewData)}.pdf`);
}
