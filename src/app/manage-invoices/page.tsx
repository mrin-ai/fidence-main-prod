import { ManageInvoicesPageContent } from "@/components/invoice/manage-invoices-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listManageInvoices } from "@/lib/db/invoices";

export const dynamic = "force-dynamic";

export default async function ManageInvoicesPage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const invoices = await listManageInvoices(session.workspace._id);

  return <ManageInvoicesPageContent initialInvoices={invoices} />;
}
