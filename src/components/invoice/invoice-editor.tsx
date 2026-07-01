"use client";

import * as React from "react";
import { usePanelRef } from "react-resizable-panels";

import { InvoiceFormPanel, useInvoiceForm } from "@/components/invoice/invoice-form";
import { InvoicePreviewPanel } from "@/components/invoice/invoice-preview";
import { InvoiceToolbar } from "@/components/invoice/invoice-toolbar";
import type { InvoiceViewTab } from "@/components/invoice/invoice-tab-switch";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import { cn } from "@/lib/utils";

export function InvoiceEditor({
  defaultValues,
  invoiceId,
}: {
  defaultValues: InvoiceFormData;
  invoiceId?: string;
}) {
  const form = useInvoiceForm(defaultValues);
  const isMobile = useIsMobile();
  const [viewTab, setViewTab] = React.useState<InvoiceViewTab>("both");
  const formPanelRef = usePanelRef();
  const previewPanelRef = usePanelRef();

  React.useEffect(() => {
    const formPanel = formPanelRef.current;
    const previewPanel = previewPanelRef.current;
    if (!formPanel || !previewPanel) return;

    if (isMobile && viewTab === "both") {
      setViewTab("form");
      return;
    }

    if (viewTab === "form") {
      formPanel.expand();
      previewPanel.collapse();
      formPanel.resize("100%");
      return;
    }

    if (viewTab === "preview") {
      previewPanel.expand();
      formPanel.collapse();
      previewPanel.resize("100%");
      return;
    }

    formPanel.expand();
    previewPanel.expand();
    formPanel.resize("50%");
    previewPanel.resize("50%");
  }, [viewTab, isMobile, formPanelRef, previewPanelRef]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InvoiceToolbar
        form={form}
        viewTab={viewTab}
        onViewTabChange={setViewTab}
        invoiceId={invoiceId}
      />
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          id="invoice-form-panel"
          panelRef={formPanelRef}
          defaultSize="50%"
          collapsible
          className="min-h-0"
        >
          <InvoiceFormPanel form={form} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="invoice-preview-panel"
          panelRef={previewPanelRef}
          defaultSize="50%"
          collapsible
          className={cn("min-h-0", viewTab === "both" ? "hidden md:flex" : "flex")}
        >
          <InvoicePreviewPanel form={form} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
