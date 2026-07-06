"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function InvoicePdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-4 px-6 py-6">
      {loadError ? (
        <p className="text-sm text-muted-foreground">{loadError}</p>
      ) : (
        <Document
          file={url}
          onLoadSuccess={({ numPages: loadedPages }) => {
            setLoadError(null);
            setNumPages(loadedPages);
          }}
          onLoadError={(err) => {
            setLoadError(
              err instanceof Error ? err.message : "Failed to load PDF preview",
            );
          }}
          loading={null}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Page
              key={`page-${index + 1}`}
              pageNumber={index + 1}
              width={520}
              className="overflow-hidden rounded-lg border border-border/50 bg-white shadow-sm"
            />
          ))}
        </Document>
      )}
    </div>
  );
}
