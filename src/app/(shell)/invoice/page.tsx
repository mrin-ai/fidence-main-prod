import { listInvoices } from "@/lib/db/invoices";
import { getSessionFromCookies } from "@/lib/db/auth";
import { InvoiceList } from "@/components/invoice/invoice-list";

export default async function InvoicePage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const invoices = await listInvoices(session.workspace._id);

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <InvoiceList
        invoices={invoices.map((invoice) => ({
          ...invoice,
          date: invoice.date.toISOString(),
          updatedAt: invoice.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
