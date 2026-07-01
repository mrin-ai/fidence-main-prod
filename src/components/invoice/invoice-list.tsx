"use client";

import Link from "next/link";
import { FilePlus2Icon, FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import { formatCurrency } from "@/lib/invoice/currency";
import { formatPaymentDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export type InvoiceListItem = {
  id: string;
  reference: string;
  clientName: string;
  status: string;
  currency: string;
  total: number;
  date: string;
  updatedAt: string;
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  sent: "default",
  paid: "default",
  cancelled: "destructive",
};

export function InvoiceList({ invoices }: { invoices: InvoiceListItem[] }) {
  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-medium">Invoices</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create, preview, and download professional invoices.
          </p>
        </div>
        <Link href="/invoice/new" className={cn(buttonVariants())}>
          <FilePlus2Icon data-icon="inline-start" />
          New invoice
        </Link>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-secondary/10 px-6 py-16 text-center">
            <FileTextIcon className="size-8 text-primary/70" />
            <div>
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first invoice with live PDF preview.
              </p>
            </div>
            <Link href="/invoice/new" className={cn(buttonVariants())}>
              Create invoice
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      href={`/invoice/${invoice.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {invoice.reference}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[invoice.status] ?? "outline"}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatPaymentDateTime(invoice.date)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
