import { buildInvoiceDefaults } from "@/lib/invoice/build-defaults";
import { getNextInvoiceSerial } from "@/lib/db/invoices";
import { getSessionFromCookies } from "@/lib/db/auth";
import { InvoiceEditor } from "@/components/invoice/invoice-editor";

export default async function NewInvoicePage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const serialNumber = await getNextInvoiceSerial(session.workspace._id);
  const defaultValues = buildInvoiceDefaults({
    user: session.user,
    serialNumber,
  });

  return (
    <div className="flex h-[calc(100svh-var(--header-height))] min-h-0 flex-col">
      <InvoiceEditor defaultValues={defaultValues} />
    </div>
  );
}
