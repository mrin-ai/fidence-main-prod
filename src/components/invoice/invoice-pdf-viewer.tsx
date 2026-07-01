"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function InvoicePdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = React.useState(0);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Document
        file={url}
        onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
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
    </div>
  );
}
