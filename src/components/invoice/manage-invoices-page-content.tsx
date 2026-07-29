"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FilePlus2Icon,
  FileTextIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import type { ManageInvoiceListItem } from "@/lib/db/invoices";
import type { InvoiceStatus } from "@/lib/db/types";
import { formatCurrency } from "@/lib/invoice/currency";
import {
  MANAGE_INVOICES_PAGE_SIZE,
  type ManageInvoiceFilterStatus,
  type ManageInvoiceSort,
  type ManageInvoiceSortField,
} from "@/lib/invoice/manage-invoices";
import { cn } from "@/lib/utils";

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

const statusBadgeClassName: Record<InvoiceStatus, string> = {
  draft: "border-border bg-secondary/40 text-muted-foreground",
  sent: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-red-600 bg-red-600/10 text-red-700 dark:text-red-400",
};

const invoiceDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

function formatInvoiceDate(value: string) {
  return invoiceDateFormatter.format(new Date(value));
}

function SortableHead({
  label,
  field,
  activeField,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: ManageInvoiceSortField;
  activeField: ManageInvoiceSortField;
  sort: ManageInvoiceSort;
  onSort: (field: ManageInvoiceSortField) => void;
  className?: string;
}) {
  const isActive = activeField === field;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive && sort === "asc" ? (
          <ArrowUpIcon className="size-3.5 text-muted-foreground" />
        ) : isActive && sort === "desc" ? (
          <ArrowDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ArrowUpDownIcon className="size-3.5 text-muted-foreground/70" />
        )}
      </button>
    </TableHead>
  );
}

function buildManageInvoicesHref(options: {
  page?: number;
  status?: ManageInvoiceFilterStatus;
  sortField?: ManageInvoiceSortField;
  sort?: ManageInvoiceSort;
}) {
  const params = new URLSearchParams();
  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }
  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }
  if (options.sortField && options.sortField !== "createdAt") {
    params.set("sortField", options.sortField);
  }
  if (options.sort && options.sort !== "desc") {
    params.set("sort", options.sort);
  }
  const query = params.toString();
  return query ? `/manage-invoices?${query}` : "/manage-invoices";
}

export function ManageInvoicesPageContent({
  feed,
  statusFilter,
  sortField,
  sort,
}: {
  feed: {
    items: ManageInvoiceListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  statusFilter: ManageInvoiceFilterStatus;
  sortField: ManageInvoiceSortField;
  sort: ManageInvoiceSort;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function handleSort(field: ManageInvoiceSortField) {
    const nextSort =
      sortField === field ? (sort === "asc" ? "desc" : "asc") : "desc";
    window.location.href = buildManageInvoicesHref({
      page: 1,
      status: statusFilter,
      sortField: field,
      sort: nextSort,
    });
  }

  async function handleDeleteInvoice(invoice: ManageInvoiceListItem) {
    const confirmed = window.confirm(
      `Delete invoice ${invoice.reference}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to delete invoice");
      }

      toast.success(`Deleted ${invoice.reference}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete invoice",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const currentPage = feed.page;
  const pageStart =
    feed.total === 0 ? 0 : (currentPage - 1) * feed.limit + 1;
  const pageEnd = Math.min(currentPage * feed.limit, feed.total);
  const paginatedInvoices = feed.items;

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Track payments and open any invoice to edit or share.
          </p>
        </div>
        <Link href="/invoice/new" className={cn(buttonVariants())}>
          <FilePlus2Icon data-icon="inline-start" />
          New invoice
        </Link>
      </div>

      <Card className={dashboardCardClassName}>
        <CardHeader className="pb-3">
          <Tabs
            value={statusFilter}
            onValueChange={(value) => {
              window.location.href = buildManageInvoicesHref({
                page: 1,
                status: value as ManageInvoiceFilterStatus,
                sortField,
                sort,
              });
            }}
          >
            <TabsList>
              {(["all", "draft", "sent", "paid", "cancelled"] as const).map(
                (status) => (
                  <TabsTrigger key={status} value={status}>
                    {status === "all"
                      ? "All"
                      : statusLabel[status as InvoiceStatus]}
                  </TabsTrigger>
                ),
              )}
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          {paginatedInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-secondary/10 px-6 py-16 text-center">
              <FileTextIcon className="size-8 text-primary/70" />
              <div>
                <p className="text-sm font-medium">No invoices yet</p>
                <p className="text-sm text-muted-foreground">
                  {statusFilter === "all"
                    ? "Create an invoice to get started."
                    : `No ${statusLabel[statusFilter as InvoiceStatus].toLowerCase()} invoices.`}
                </p>
              </div>
              {statusFilter === "all" ? (
                <Link href="/invoice/new" className={cn(buttonVariants())}>
                  Create invoice
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/60 [&_tr]:border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-11 px-4">Invoice</TableHead>
                      <TableHead className="h-11 px-4">Client</TableHead>
                      <SortableHead
                        label="Items"
                        field="items"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="h-11 px-4 text-right"
                      />
                      <TableHead className="h-11 w-[120px] px-4">
                        Status
                      </TableHead>
                      <SortableHead
                        label="Amount"
                        field="total"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="h-11 min-w-[120px] px-4 text-right"
                      />
                      <SortableHead
                        label="Date"
                        field="invoiceDate"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="h-11 min-w-[120px] px-4"
                      />
                      <SortableHead
                        label="Paid"
                        field="paidAt"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="h-11 min-w-[120px] px-4"
                      />
                      <TableHead className="h-11 w-28 px-4 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="border-border/80 hover:bg-muted/40"
                      >
                        <TableCell className="px-4 py-3.5">
                          <Link
                            href={`/invoice/${invoice.id}`}
                            className="group flex flex-col gap-0.5"
                          >
                            <span className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                              {invoice.reference}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{invoice.serialNumber}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate px-4 py-3.5 text-sm">
                          {invoice.clientName || "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                          {invoice.itemCount}
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={
                              statusBadgeClassName[invoice.status] ?? undefined
                            }
                          >
                            {statusLabel[invoice.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-right font-medium tabular-nums">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                          {formatInvoiceDate(invoice.invoiceDate)}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                          {invoice.paidAt
                            ? formatInvoiceDate(invoice.paidAt)
                            : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Edit invoice"
                              nativeButton={false}
                              render={
                                <Link href={`/invoice/${invoice.id}`} />
                              }
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Delete invoice"
                              disabled={deletingId === invoice.id}
                              className="text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                              onClick={() => {
                                void handleDeleteInvoice(invoice);
                              }}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {feed.total > MANAGE_INVOICES_PAGE_SIZE ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pageStart}–{pageEnd} of {feed.total}
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href={buildManageInvoicesHref({
                            page: Math.max(1, currentPage - 1),
                            status: statusFilter,
                            sortField,
                            sort,
                          })}
                          className={
                            currentPage <= 1
                              ? "pointer-events-none opacity-50"
                              : undefined
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: feed.totalPages }, (_, index) => {
                        const pageNumber = index + 1;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              href={buildManageInvoicesHref({
                                page: pageNumber,
                                status: statusFilter,
                                sortField,
                                sort,
                              })}
                              isActive={pageNumber === currentPage}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          href={buildManageInvoicesHref({
                            page: Math.min(feed.totalPages, currentPage + 1),
                            status: statusFilter,
                            sortField,
                            sort,
                          })}
                          className={
                            currentPage >= feed.totalPages
                              ? "pointer-events-none opacity-50"
                              : undefined
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
