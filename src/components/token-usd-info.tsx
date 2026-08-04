"use client";

import { InfoIcon } from "lucide-react";

import { useTokenPricesContext } from "@/components/token-prices-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getTokenById } from "@/lib/create-payment-link-data";
import {
  formatTokenUsdPrice,
} from "@/lib/coingecko/format-price";
import { resolveTokenIdFromSymbol } from "@/lib/coingecko/resolve-token-id";
import { cn } from "@/lib/utils";

type TokenUsdInfoProps = {
  amount: number;
  tokenId?: string | null;
  symbol?: string | null;
  className?: string;
};

export function TokenUsdInfo({
  amount,
  tokenId,
  symbol,
  className,
}: TokenUsdInfoProps) {
  const pricesContext = useTokenPricesContext();
  const resolvedTokenId =
    tokenId?.trim().toLowerCase() ||
    (symbol ? resolveTokenIdFromSymbol(symbol) : null);

  if (!resolvedTokenId || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const displaySymbol =
    symbol?.toUpperCase() ??
    getTokenById(resolvedTokenId)?.symbol ??
    resolvedTokenId.toUpperCase();

  const price = pricesContext?.getPrice(resolvedTokenId) ?? null;
  const loading = pricesContext?.loading ?? false;
  const usdValue = price ? amount * price : null;

  if (!loading && !price) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              className,
            )}
            aria-label={`USD value for ${amount} ${displaySymbol}`}
          />
        }
      >
        <InfoIcon className="size-3" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        {loading ? (
          <p>Loading live price…</p>
        ) : price && usdValue ? (
          <div className="space-y-1">
            <p>
              Live: {formatTokenUsdPrice(price)} / {displaySymbol}
            </p>
            <p className="font-medium">
              ≈ {formatTokenUsdPrice(usdValue)} USD
            </p>
          </div>
        ) : (
          <p>Live price unavailable</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
