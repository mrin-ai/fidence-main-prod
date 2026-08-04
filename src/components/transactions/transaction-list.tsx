import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { TokenUsdInfo } from "@/components/token-usd-info";
import { truncateAddress } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

import type { TransactionListItem } from "@/lib/db/transactions-feed";

export function TransactionList({
  transactions,
  source = "human",
}: {
  transactions: TransactionListItem[];
  source?: "human" | "agent";
}) {
  if (transactions.length === 0) {
    return (
      <EmptyStateLottie
        title="No transactions yet"
        description={
          source === "agent"
            ? "Agent payments will show up here."
            : "Payments you send or receive will show up here."
        }
      />
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {transactions.map((tx) => {
        const isOutgoing = tx.direction === "out";

        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isOutgoing
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-emerald-500/10 text-emerald-600",
              )}
            >
              {isOutgoing ? (
                <ArrowUpRightIcon className="size-4" />
              ) : (
                <ArrowDownLeftIcon className="size-4" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{tx.label}</p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>

            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-1">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isOutgoing ? "text-amber-700" : "text-emerald-600",
                  )}
                >
                  {tx.amount}
                </p>
                <TokenUsdInfo
                  amount={tx.tokenAmount}
                  tokenId={tx.tokenId}
                  symbol={tx.tokenSymbol}
                />
              </div>
              {tx.explorerUrl && tx.txHash ? (
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                >
                  {truncateAddress(tx.txHash, 4)}
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
