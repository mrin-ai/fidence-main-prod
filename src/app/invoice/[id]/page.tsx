import { notFound } from "next/navigation";

import { InvoiceEditor } from "@/components/invoice/invoice-editor";
import { getInvoiceById } from "@/lib/db/invoices";
import { getSessionFromCookies } from "@/lib/db/auth";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditInvoicePage({ params }: PageProps) {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const { id } = await params;
  const invoice = await getInvoiceById(session.workspace._id, id);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col">
      <InvoiceEditor
        defaultValues={invoice.fields}
        invoiceId={invoice.id}
        initialPaymentLink={invoice.paymentLink}
        initialStatus={invoice.status}
      />
    </div>
  );
}
