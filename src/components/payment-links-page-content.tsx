"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  Link2Icon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useCreatePaymentLink } from "@/components/create-payment-link-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommerceSourceToggle } from "@/components/merchant/commerce-source-toggle";
import type { CommerceSource } from "@/lib/db/merchant-types";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import type { PaymentLinkListItem } from "@/lib/db/payment-links";
import { formatPaymentDateTime } from "@/lib/format-date";
import {
  matchesPaymentLinkFilter,
  PAYMENT_LINKS_PAGE_SIZE,
  type PaymentLinkFilterStatus,
  type PaymentLinkSort,
} from "@/lib/payment-link-status";
import type { PaymentLinkStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const statusVariant: Record<
  PaymentLinkStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  pending: "secondary",
  expired: "destructive",
  cancelled: "destructive",
};

const statusLabel: Record<PaymentLinkStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  expired: "Failed",
  cancelled: "Failed",
};

function countByFilter(
  links: PaymentLinkListItem[],
  filter: PaymentLinkFilterStatus,
) {
  if (filter === "all") return links.length;
  return links.filter((link) => matchesPaymentLinkFilter(link.status, filter))
    .length;
}

export function PaymentLinksPageContent({
  initialLinks,
}: {
  initialLinks: PaymentLinkListItem[];
}) {
  const { openCreatePaymentLink } = useCreatePaymentLink();
  const [links, setLinks] = React.useState(initialLinks);
  const [sourceMode, setSourceMode] = React.useState<CommerceSource>("human");
  const [statusFilter, setStatusFilter] =
    React.useState<PaymentLinkFilterStatus>("all");
  const [sort, setSort] = React.useState<PaymentLinkSort>("newest");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, sort, search, sourceMode]);

  React.useEffect(() => {
    if (
      sourceMode === "human" &&
      statusFilter === "all" &&
      sort === "newest" &&
      !search.trim()
    ) {
      setLinks(initialLinks);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setIsRefreshing(true);
      try {
        const params = new URLSearchParams({
          status: statusFilter,
          sort,
          source: sourceMode,
        });
        if (search.trim()) {
          params.set("q", search.trim());
        }

        const response = await fetch(`/api/payment-links?${params.toString()}`, {
          signal: controller.signal,
        });

        if (cancelled || !response.ok) return;

        const payload = (await response.json()) as { links: PaymentLinkListItem[] };
        if (!cancelled) {
          setLinks(payload.links);
        }
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        console.error("Failed to refresh payment links:", error);
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [statusFilter, sort, search, sourceMode, initialLinks]);

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Payment link copied");
  }

  const filteredCount = links.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAYMENT_LINKS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredCount === 0 ? 0 : (currentPage - 1) * PAYMENT_LINKS_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAYMENT_LINKS_PAGE_SIZE, filteredCount);
  const paginatedLinks = links.slice(
    (currentPage - 1) * PAYMENT_LINKS_PAGE_SIZE,
    currentPage * PAYMENT_LINKS_PAGE_SIZE,
  );

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <Card className={dashboardCardClassName}>
        <CardHeader className="gap-4 space-y-0 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base font-medium">Payment links</CardTitle>
              <p className="text-sm text-muted-foreground">
                {sourceMode === "agent"
                  ? "Payment links created by registered agents through your API."
                  : "Create, share, and track crypto payment links for your workspace."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <CommerceSourceToggle
                value={sourceMode}
                onChange={setSourceMode}
              />
              {sourceMode === "human" ? (
                <Button type="button" onClick={openCreatePaymentLink}>
                  <PlusIcon data-icon="inline-start" />
                  New link
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as PaymentLinkFilterStatus)
              }
            >
              <TabsList>
                <TabsTrigger value="all">
                  All ({countByFilter(initialLinks, "all")})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({countByFilter(initialLinks, "pending")})
                </TabsTrigger>
                <TabsTrigger value="paid">
                  Paid ({countByFilter(initialLinks, "paid")})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Failed ({countByFilter(initialLinks, "failed")})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-[220px] flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search link, amount, network…"
                  className="pl-8"
                />
              </div>
              <Select
                value={sort}
                onValueChange={(value) => {
                  if (!value) return;
                  setSort(value as PaymentLinkSort);
                }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <ArrowUpDownIcon className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-secondary/10 px-6 py-16 text-center">
              <Link2Icon className="size-8 text-primary/70" />
              <div>
                <p className="text-sm font-medium">No payment links found</p>
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "Try a different search or filter."
                    : "Create your first payment link to start collecting."}
                </p>
              </div>
              {!search.trim() && statusFilter === "all" && sourceMode === "human" ? (
                <Button type="button" onClick={openCreatePaymentLink}>
                  Create link
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    {sourceMode === "agent" ? (
                      <TableHead>Agent</TableHead>
                    ) : null}
                    <TableHead>Status</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-mono text-sm font-medium tabular-nums">
                        {link.amountLabel}
                      </TableCell>
                      {sourceMode === "agent" ? (
                        <TableCell className="font-mono text-xs">
                          {link.agentPublicId ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant={statusVariant[link.status] ?? "outline"}>
                          {statusLabel[link.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{link.networkLabel}</TableCell>
                      <TableCell>
                        <Link
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="max-w-[14rem] truncate font-mono text-xs text-primary hover:underline"
                        >
                          {link.publicId}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatPaymentDateTime(link.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatPaymentDateTime(link.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Copy link"
                            onClick={() => handleCopy(link.url)}
                          >
                            <CopyIcon className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open link"
                            onClick={() =>
                              window.open(link.url, "_blank", "noopener,noreferrer")
                            }
                          >
                            <ExternalLinkIcon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredCount > PAYMENT_LINKS_PAGE_SIZE ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pageStart}–{pageEnd} of {filteredCount} links
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setPage((current) => Math.max(1, current - 1));
                          }}
                          className={
                            currentPage <= 1
                              ? "pointer-events-none opacity-50"
                              : undefined
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, index) => {
                        const pageNumber = index + 1;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              href="#"
                              isActive={pageNumber === currentPage}
                              onClick={(event) => {
                                event.preventDefault();
                                setPage(pageNumber);
                              }}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setPage((current) =>
                              Math.min(totalPages, current + 1),
                            );
                          }}
                          className={
                            currentPage >= totalPages
                              ? "pointer-events-none opacity-50"
                              : undefined
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
              <p
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-background to-transparent opacity-0 transition-opacity",
                  isRefreshing && "opacity-100",
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
