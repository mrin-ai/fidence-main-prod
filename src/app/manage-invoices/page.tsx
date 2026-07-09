import { ManageInvoicesPageContent } from "@/components/invoice/manage-invoices-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listManageInvoicesPaginated } from "@/lib/db/invoices";
import {
  MANAGE_INVOICES_PAGE_SIZE,
  type ManageInvoiceFilterStatus,
  type ManageInvoiceSort,
  type ManageInvoiceSortField,
} from "@/lib/invoice/manage-invoices";

export const dynamic = "force-dynamic";

export default async function ManageInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    sort?: string;
    sortField?: string;
  }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const status = (params.status ?? "all") as ManageInvoiceFilterStatus;
  const sort = (params.sort ?? "desc") as ManageInvoiceSort;
  const sortField = (params.sortField ?? "createdAt") as ManageInvoiceSortField;

  const feed = await listManageInvoicesPaginated(session.workspace._id, {
    page,
    limit: MANAGE_INVOICES_PAGE_SIZE,
    status,
    sortField,
    sort,
  });

  return (
    <ManageInvoicesPageContent
      feed={feed}
      statusFilter={status}
      sortField={sortField}
      sort={sort}
    />
  );
}
