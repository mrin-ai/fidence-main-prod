"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
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
  getPaymentTokenIcon,
  getSupportedPaymentTokens,
  getTokenById,
} from "@/lib/create-payment-link-data";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import { getWalletNetworkIcon } from "@/lib/wallet-networks";
import { cn } from "@/lib/utils";

function TokenOption({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const iconSrc = getPaymentTokenIcon(id);
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/70">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            width={id === "eth" ? 16 : 14}
            height={id === "eth" ? 16 : 14}
            className={cn(
              "object-contain",
              id === "eth" ? "size-4" : "size-3.5",
            )}
          />
        ) : null}
      </span>
      <span className="font-medium">{label}</span>
    </span>
  );
}

function NetworkOption({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const iconSrc = getWalletNetworkIcon(id);
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/70">
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            width={14}
            height={14}
            className="size-3.5 object-contain"
          />
        ) : null}
      </span>
      <span className="font-medium">{label}</span>
    </span>
  );
}

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

  const supportedTokens = React.useMemo(() => getSupportedPaymentTokens(), []);

  const availableNetworks = React.useMemo(
    () => getNetworksForToken(tokenId),
    [tokenId],
  );

  const selectedToken = getTokenById(tokenId);
  const selectedNetwork = getNetworkById(networkId);
  const [verifiedNetworkIds, setVerifiedNetworkIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    void fetch("/api/wallets")
      .then((response) => response.json())
      .then((data: { verifiedNetworkIds?: string[] }) => {
        setVerifiedNetworkIds(data.verifiedNetworkIds ?? []);
      })
      .catch(() => setVerifiedNetworkIds([]));
  }, []);

  const hasVerifiedWallet =
    !networkId || verifiedNetworkIds.includes(networkId);
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

      <div className="flex flex-wrap items-start gap-3">
        <Field className="w-auto min-w-[7.5rem]">
          <FieldLabel>
            Token <span className="text-destructive">*</span>
          </FieldLabel>
          <FieldContent>
            <Select
              value={tokenId}
              onValueChange={(value) => {
                if (!value) return;
                form.setValue("paymentLink.tokenId", value, {
                  shouldDirty: true,
                });
                form.setValue("paymentLink.networkId", "", {
                  shouldDirty: true,
                });
              }}
              items={supportedTokens.map((token) => ({
                label: token.symbol,
                value: token.id,
              }))}
            >
              <SelectTrigger className="h-9 w-[7.5rem]">
                <SelectValue placeholder="Token">
                  {selectedToken ? (
                    <TokenOption
                      id={selectedToken.id}
                      label={selectedToken.symbol}
                    />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="w-auto min-w-0 p-1"
              >
                <SelectGroup>
                  {supportedTokens.map((token) => (
                    <SelectItem
                      key={token.id}
                      value={token.id}
                      className="rounded-md py-1.5 pr-8"
                    >
                      <TokenOption id={token.id} label={token.symbol} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>

        <Field className="w-auto min-w-[9rem]">
          <FieldLabel>
            Network <span className="text-destructive">*</span>
          </FieldLabel>
          <FieldContent>
            <Select
              value={networkId}
              onValueChange={(value) => {
                if (!value) return;
                form.setValue("paymentLink.networkId", value, {
                  shouldDirty: true,
                });
              }}
              items={availableNetworks.map((network) => ({
                label: network.label,
                value: network.id,
              }))}
            >
              <SelectTrigger className="h-9 w-[9rem]">
                <SelectValue placeholder="Network">
                  {selectedNetwork ? (
                    <NetworkOption
                      id={selectedNetwork.id}
                      label={selectedNetwork.label}
                    />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="w-auto min-w-0 p-1"
              >
                <SelectGroup>
                  {availableNetworks.map((network) => (
                    <SelectItem
                      key={network.id}
                      value={network.id}
                      className="rounded-md py-1.5 pr-8"
                    >
                      <NetworkOption
                        id={network.id}
                        label={network.label}
                      />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {form.formState.errors.paymentLink?.networkId ? (
              <FieldDescription className="text-destructive">
                {form.formState.errors.paymentLink.networkId.message}
              </FieldDescription>
            ) : null}
          </FieldContent>
        </Field>
      </div>
      {!form.formState.errors.paymentLink?.networkId ? (
        <FieldDescription>
          Client pays in the selected token on this network.
        </FieldDescription>
      ) : null}

      {networkId && !hasVerifiedWallet ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add and verify a wallet for {selectedNetwork?.label ?? networkId} in{" "}
          <Link href="/wallets" className="font-medium underline">
            Wallets
          </Link>{" "}
          before saving this invoice.
        </div>
      ) : null}

      {savedPaymentLink ? (
        <div className="rounded-xl border border-border/60 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
          {savedPaymentLink.status === "paid" ? (
            <>
              This invoice is marked as{" "}
              <span className="font-medium text-emerald-700">Paid</span> on the
              invoice preview.
            </>
          ) : (
            <>
              Payment is enabled. Use the{" "}
              <span className="font-medium text-foreground">Pay invoice</span>{" "}
              button at the bottom of the invoice preview.
            </>
          )}
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
