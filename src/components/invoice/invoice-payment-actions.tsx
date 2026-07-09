"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon, ExternalLinkIcon, Link2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getNetworkById,
  getTokenById,
} from "@/lib/create-payment-link-data";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import { cn } from "@/lib/utils";

const statusLabel: Record<InvoicePaymentLinkInfo["status"], string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function InvoicePaymentActions({
  paymentLink,
  invoiceReference,
  compact = false,
}: {
  paymentLink: InvoicePaymentLinkInfo;
  invoiceReference?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const token = getTokenById(paymentLink.tokenId);
  const network = getNetworkById(paymentLink.networkId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(paymentLink!.url);
      setCopied(true);
      toast.success("Payment link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Card className={compact ? "border-border/60 shadow-none" : undefined}>
      <CardHeader
        className={cn(
          "flex flex-row items-start justify-between gap-3 space-y-0",
          compact ? "pb-2" : "pb-3",
        )}
      >
        <div>
          <CardTitle className="text-sm font-medium">Invoice payment</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoiceReference
              ? `Payment link for ${invoiceReference}`
              : "Share this link with your client to collect payment."}
          </p>
        </div>
        <Badge
          variant={paymentLink.status === "paid" ? "default" : "secondary"}
        >
          {statusLabel[paymentLink.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="font-mono text-sm tabular-nums">
            {paymentLink.amount.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}{" "}
            {token?.symbol ?? paymentLink.tokenId.toUpperCase()} on{" "}
            {network?.label ?? paymentLink.networkId}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {paymentLink.status === "pending" ? (
            <Link
              href={paymentLink.url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants(), "flex-1")}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              Make payment
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            Copy link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open payment link"
            nativeButton={false}
            render={
              <Link href={paymentLink.url} target="_blank" rel="noreferrer" />
            }
          >
            <Link2Icon className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
