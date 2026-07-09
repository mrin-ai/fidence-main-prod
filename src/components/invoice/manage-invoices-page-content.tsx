"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FilePlus2Icon,
  FileTextIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatPaymentDateTime } from "@/lib/format-date";
import { formatCurrency } from "@/lib/invoice/currency";
import {
  MANAGE_INVOICES_PAGE_SIZE,
  type ManageInvoiceFilterStatus,
  type ManageInvoiceSort,
  type ManageInvoiceSortField,
} from "@/lib/invoice/manage-invoices";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  InvoiceStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  sent: "default",
  paid: "default",
  cancelled: "destructive",
};

const statusLabel: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

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

  const currentPage = feed.page;
  const pageStart =
    feed.total === 0 ? 0 : (currentPage - 1) * feed.limit + 1;
  const pageEnd = Math.min(currentPage * feed.limit, feed.total);
  const paginatedInvoices = feed.items;

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <Card className={dashboardCardClassName}>
        <CardHeader className="gap-4 space-y-0 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-medium">
                Manage invoices
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                View all created invoices, track status, and open the editor.
              </p>
            </div>
            <Link href="/invoice/new" className={cn(buttonVariants())}>
              <FilePlus2Icon data-icon="inline-start" />
              New invoice
            </Link>
          </div>

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
                <p className="text-sm font-medium">No invoices found</p>
                <p className="text-sm text-muted-foreground">
                  {statusFilter === "all"
                    ? "Create your first invoice to see it here."
                    : "Try another status filter."}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Storage</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Serial No</TableHead>
                      <SortableHead
                        label="Total"
                        field="total"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableHead
                        label="Items"
                        field="items"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <TableHead>Status</TableHead>
                      <SortableHead
                        label="Invoice Date"
                        field="invoiceDate"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableHead
                        label="Created At"
                        field="createdAt"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                      />
                      <SortableHead
                        label="Paid At"
                        field="paidAt"
                        activeField={sortField}
                        sort={sort}
                        onSort={handleSort}
                      />
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <HardDriveIcon className="size-3.5 shrink-0" />
                            {invoice.storage}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {invoice.shortId}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {invoice.serialNumber}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {invoice.itemCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVariant[invoice.status] ?? "outline"}
                          >
                            {statusLabel[invoice.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatPaymentDateTime(invoice.invoiceDate)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatPaymentDateTime(invoice.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {invoice.paidAt
                            ? formatPaymentDateTime(invoice.paidAt)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit invoice"
                              nativeButton={false}
                              render={<Link href={`/invoice/${invoice.id}`} />}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Invoice actions"
                                  />
                                }
                              >
                                <MoreHorizontalIcon className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  render={
                                    <Link href={`/invoice/${invoice.id}`} />
                                  }
                                >
                                  Edit invoice
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  render={
                                    <Link href={`/invoice/${invoice.id}`} />
                                  }
                                >
                                  View details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                    Showing {pageStart}–{pageEnd} of {feed.total} invoices
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
