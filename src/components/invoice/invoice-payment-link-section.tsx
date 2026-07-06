"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateInvoiceTotal } from "@/lib/invoice/calculate-totals";
import {
  getNetworkById,
  getNetworksForToken,
  getTokenById,
  paymentTokens,
} from "@/lib/create-payment-link-data";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";

export function InvoicePaymentLinkSection({
  form,
  savedPaymentLink,
}: {
  form: UseFormReturn<InvoiceFormData>;
  savedPaymentLink?: InvoicePaymentLinkInfo | null;
}) {
  const tokenId = form.watch("paymentLink.tokenId");
  const networkId = form.watch("paymentLink.networkId");
  const currency = form.watch("invoiceDetails.currency");
  const items = form.watch("items");
  const billingDetails = form.watch("invoiceDetails.billingDetails");

  const availableNetworks = React.useMemo(
    () => getNetworksForToken(tokenId),
    [tokenId],
  );

  const selectedToken = getTokenById(tokenId);
  const selectedNetwork = getNetworkById(networkId);
  const invoiceTotal = React.useMemo(
    () =>
      calculateInvoiceTotal({
        ...form.getValues(),
        items,
        invoiceDetails: {
          ...form.getValues("invoiceDetails"),
          billingDetails,
        },
      }),
    [billingDetails, form, items],
  );

  React.useEffect(() => {
    if (
      networkId &&
      !availableNetworks.some((network) => network.id === networkId)
    ) {
      form.setValue("paymentLink.networkId", "", { shouldDirty: true });
    }
  }, [availableNetworks, form, networkId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-secondary/10 px-4 py-3">
        <p className="text-sm font-medium">Invoice payment amount</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The payment link uses your invoice total. Clients pay in crypto, not
          invoice currency.
        </p>
        <p className="mt-2 font-mono text-lg tabular-nums">
          {invoiceTotal > 0
            ? `${invoiceTotal.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })} ${selectedToken?.symbol ?? "TOKEN"}`
            : formatCurrency(0, currency)}
        </p>
      </div>

      <Field>
        <FieldLabel>
          Token <span className="text-destructive">*</span>
        </FieldLabel>
        <FieldContent>
          <Select
            value={tokenId}
            onValueChange={(value) => {
              if (!value) return;
              form.setValue("paymentLink.tokenId", value, { shouldDirty: true });
              form.setValue("paymentLink.networkId", "", { shouldDirty: true });
            }}
            items={paymentTokens.map((token) => ({
              label: token.symbol,
              value: token.id,
            }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {paymentTokens.map((token) => (
                  <SelectItem key={token.id} value={token.id}>
                    {token.symbol} · {token.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            Token your client will pay in on the payment link
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          Network <span className="text-destructive">*</span>
        </FieldLabel>
        <FieldContent>
          <Select
            value={networkId}
            onValueChange={(value) => {
              if (!value) return;
              form.setValue("paymentLink.networkId", value, { shouldDirty: true });
            }}
            items={availableNetworks.map((network) => ({
              label: network.label,
              value: network.id,
            }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableNetworks.map((network) => (
                  <SelectItem key={network.id} value={network.id}>
                    {network.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {form.formState.errors.paymentLink?.networkId ? (
            <FieldDescription className="text-destructive">
              {form.formState.errors.paymentLink.networkId.message}
            </FieldDescription>
          ) : (
            <FieldDescription>
              {selectedNetwork
                ? `Payments will be collected on ${selectedNetwork.label}`
                : "Choose the blockchain network for this invoice payment"}
            </FieldDescription>
          )}
        </FieldContent>
      </Field>

      {savedPaymentLink ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Payment link is active for this invoice. Use{" "}
          <span className="font-medium">Make payment</span> in the preview after
          saving.
        </div>
      ) : (
        <FieldDescription>
          A dedicated payment link is generated automatically when you save this
          invoice.
        </FieldDescription>
      )}
    </div>
  );
}
