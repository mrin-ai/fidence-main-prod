"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";

import { useTokenPricesContext } from "@/components/token-prices-provider";
import { TokenUsdInfo } from "@/components/token-usd-info";
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
import { convertFiatTotalToTokenAmount } from "@/lib/coingecko/convert-fiat-to-token";
import { formatTokenAmount } from "@/lib/coingecko/format-price";
import { calculateInvoiceTotal } from "@/lib/invoice/calculate-totals";
import {
  getNetworkById,
  getPaymentTokenIcon,
  getPaymentTokenIconClassName,
  getPaymentTokenIconSize,
  getTokenById,
  getTokensForNetwork,
  paymentNetworks,
} from "@/lib/create-payment-link-data";
import { formatCurrency } from "@/lib/invoice/currency";
import type { InvoiceFormData } from "@/lib/invoice/schema";
import type { InvoicePaymentLinkInfo } from "@/lib/invoice/invoice-payment-link";
import { getWalletNetworkIcon } from "@/lib/wallet-networks";
import { cn } from "@/lib/utils";

function SelectOption({
  iconSrc,
  iconClassName,
  iconSize = 14,
  label,
}: {
  iconSrc?: string | null;
  iconClassName?: string;
  iconSize?: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {iconSrc ? (
        <Image
          src={iconSrc}
          alt=""
          width={iconSize}
          height={iconSize}
          className={iconClassName ?? "size-3.5 object-contain"}
        />
      ) : null}
      <span>{label}</span>
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
  const pricesContext = useTokenPricesContext();

  const networkSelected = Boolean(networkId);
  const availableTokens = React.useMemo(
    () => (networkId ? getTokensForNetwork(networkId) : []),
    [networkId],
  );

  const selectedToken = tokenId ? getTokenById(tokenId) : undefined;
  const selectedNetwork = networkId ? getNetworkById(networkId) : undefined;
  const [verifiedNetworkIds, setVerifiedNetworkIds] = React.useState<string[]>(
    [],
  );

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

  const tokenPrice = tokenId ? (pricesContext?.getPrice(tokenId) ?? null) : null;
  const conversion = React.useMemo(() => {
    if (!tokenId || invoiceTotal <= 0) return null;
    return convertFiatTotalToTokenAmount({
      fiatTotal: invoiceTotal,
      fiatCurrency: currency,
      tokenId,
      tokenPriceUsd: tokenPrice,
    });
  }, [currency, invoiceTotal, tokenId, tokenPrice]);

  const displayTokenAmount = savedPaymentLink?.amount ?? conversion?.tokenAmount;
  const displaySymbol = selectedToken?.symbol ?? tokenId?.toUpperCase() ?? "—";

  React.useEffect(() => {
    if (!networkId) return;

    if (
      tokenId &&
      !availableTokens.some((token) => token.id === tokenId)
    ) {
      form.setValue("paymentLink.tokenId", availableTokens[0]?.id ?? "", {
        shouldDirty: true,
      });
    } else if (!tokenId && availableTokens[0]) {
      form.setValue("paymentLink.tokenId", availableTokens[0].id, {
        shouldDirty: true,
      });
    }
  }, [availableTokens, form, networkId, tokenId]);

  function handleNetworkChange(value: string | null) {
    if (!value) {
      form.setValue("paymentLink.networkId", "", { shouldDirty: true });
      form.setValue("paymentLink.tokenId", "", { shouldDirty: true });
      return;
    }

    const tokens = getTokensForNetwork(value);
    const keepToken = tokens.some((token) => token.id === tokenId);

    form.setValue("paymentLink.networkId", value, { shouldDirty: true });
    form.setValue(
      "paymentLink.tokenId",
      keepToken ? tokenId : (tokens[0]?.id ?? ""),
      { shouldDirty: true },
    );
  }

  const paymentLinkError =
    form.formState.errors.paymentLink?.networkId?.message ??
    form.formState.errors.paymentLink?.tokenId?.message;

  if (invoiceTotal <= 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums">
        <span className="font-medium">
          {formatCurrency(invoiceTotal, currency)}
        </span>
        <span className="text-muted-foreground">→</span>
        {displayTokenAmount != null && tokenId ? (
          <span className="inline-flex items-center gap-1 font-medium">
            {formatTokenAmount(displayTokenAmount)} {displaySymbol}
            <TokenUsdInfo
              amount={displayTokenAmount}
              tokenId={tokenId}
              symbol={displaySymbol}
            />
          </span>
        ) : (
          <span className="text-muted-foreground">pick network & token</span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field className="gap-1">
          <FieldLabel className="text-xs">
            Network <span className="text-destructive">*</span>
          </FieldLabel>
          <FieldContent>
            <Select
              value={networkId || null}
              onValueChange={handleNetworkChange}
              items={paymentNetworks.map((network) => ({
                label: network.label,
                value: network.id,
              }))}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Network">
                  {selectedNetwork ? (
                    <SelectOption
                      iconSrc={getWalletNetworkIcon(selectedNetwork.id)}
                      label={selectedNetwork.label}
                    />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                alignItemWithTrigger={false}
                className="p-1"
              >
                <SelectGroup>
                  {paymentNetworks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      <SelectOption
                        iconSrc={getWalletNetworkIcon(network.id)}
                        label={network.label}
                      />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>

        <Field
          className={cn(
            "gap-1 transition-opacity",
            !networkSelected && "pointer-events-none opacity-45",
          )}
        >
          <FieldLabel className="text-xs">
            Token <span className="text-destructive">*</span>
          </FieldLabel>
          <FieldContent>
            <Select
              value={tokenId || null}
              disabled={!networkSelected || availableTokens.length === 0}
              onValueChange={(value) => {
                if (!value) return;
                form.setValue("paymentLink.tokenId", value, {
                  shouldDirty: true,
                });
              }}
              items={availableTokens.map((token) => ({
                label: token.symbol,
                value: token.id,
              }))}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Token">
                  {selectedToken ? (
                    <SelectOption
                      iconSrc={getPaymentTokenIcon(selectedToken.id)}
                      iconClassName={getPaymentTokenIconClassName(
                        selectedToken.id,
                      )}
                      iconSize={getPaymentTokenIconSize(selectedToken.id)}
                      label={selectedToken.symbol}
                    />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                side="bottom"
                align="start"
                alignItemWithTrigger={false}
                className="p-1"
              >
                <SelectGroup>
                  {availableTokens.map((token) => (
                    <SelectItem key={token.id} value={token.id}>
                      <SelectOption
                        iconSrc={getPaymentTokenIcon(token.id)}
                        iconClassName={getPaymentTokenIconClassName(token.id)}
                        iconSize={getPaymentTokenIconSize(token.id)}
                        label={token.symbol}
                      />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
      </div>

      {paymentLinkError ? (
        <FieldDescription className="text-[11px] text-destructive">
          {paymentLinkError}
        </FieldDescription>
      ) : networkId && !hasVerifiedWallet ? (
        <FieldDescription className="text-[11px] text-amber-700">
          Verify a {selectedNetwork?.label ?? networkId} wallet in{" "}
          <Link href="/wallets" className="underline">
            Wallets
          </Link>
          .
        </FieldDescription>
      ) : savedPaymentLink?.status === "paid" ? (
        <FieldDescription className="text-[11px] text-emerald-700">
          Paid
        </FieldDescription>
      ) : null}
    </div>
  );
}
