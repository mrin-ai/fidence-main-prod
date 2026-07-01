"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { UseFormReturn } from "react-hook-form";

import { Skeleton } from "@/components/ui/skeleton";
import {
  createInvoicePdfBlob,
  downloadBlob,
} from "@/lib/invoice/pdf/create-pdf-blob";
import {
  invoiceFormSchema,
  type InvoiceFormData,
} from "@/lib/invoice/schema";
import { invoiceReference } from "@/lib/invoice/schema";

const PdfViewer = dynamic(
  () => import("@/components/invoice/invoice-pdf-viewer").then((mod) => mod.InvoicePdfViewer),
  {
    ssr: false,
    loading: () => <InvoicePreviewSkeleton />,
  },
);

function InvoicePreviewSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <Skeleton className="h-[720px] w-full max-w-[520px]" />
      <p className="text-xs text-muted-foreground">Generating preview…</p>
    </div>
  );
}

export function InvoicePreviewPanel({
  form,
}: {
  form: UseFormReturn<InvoiceFormData>;
}) {
  const [previewData, setPreviewData] = React.useState<InvoiceFormData | null>(
    null,
  );
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const subscription = form.watch((value) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        const parsed = invoiceFormSchema.safeParse(value);
        if (!parsed.success) {
          if (!cancelled) {
            setError("Fix form errors to update the preview");
          }
          return;
        }

        if (!cancelled) {
          setPreviewData(parsed.data);
          setError(null);
          setIsGenerating(true);
        }

        try {
          const blob = await createInvoicePdfBlob(parsed.data);
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
      }, 900);
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [form]);

  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-muted/20">
      {error ? (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          {error}
        </div>
      ) : isGenerating || !pdfUrl || !previewData ? (
        <InvoicePreviewSkeleton />
      ) : (
        <PdfViewer url={pdfUrl} />
      )}
    </div>
  );
}

export async function downloadInvoicePdf(form: UseFormReturn<InvoiceFormData>) {
  const parsed = invoiceFormSchema.safeParse(form.getValues());
  if (!parsed.success) {
    throw new Error("Fix form errors before downloading");
  }

  const blob = await createInvoicePdfBlob(parsed.data);
  downloadBlob(blob, `${invoiceReference(parsed.data)}.pdf`);
}
