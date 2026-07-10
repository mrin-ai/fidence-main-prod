"use client"

import Link from "next/link"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyStateLottie } from "@/components/empty-state-lottie"
import {
  dashboardCardClassName,
  dashboardPanelBodyHeightClassName,
  dashboardPanelFadeClassName,
  dashboardPanelHeaderClassName,
  dashboardPanelScrollClassName,
  dashboardPanelTitleClassName,
} from "@/lib/dashboard-styles"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { cn } from "@/lib/utils"

export function RecentTransactions({
  transactions,
  className,
}: {
  transactions: Array<{
    id: string
    label: string
    date: string
    amount: string
    direction: "in" | "out"
    txHash?: string
    explorerUrl?: string
  }>
  className?: string
}) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Recent Transactions
        </CardTitle>
        <CardAction>
          <Link
            href="/transactions"
            className="inline-flex h-auto items-center gap-1 px-0 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all
            <ArrowUpRightIcon className="size-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div
          ref={scrollRef}
          className={cn(
            dashboardPanelBodyHeightClassName,
            dashboardPanelScrollClassName,
            transactions.length === 0
              ? "flex items-center justify-center"
              : "flex flex-col gap-4",
          )}
        >
          {transactions.length === 0 ? (
            <EmptyStateLottie
              title="No transactions yet"
              description="Payments you send or receive will appear here."
            />
          ) : (
            transactions.map((tx) => {
              const isOutgoing = tx.direction === "out"

              return (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      isOutgoing
                        ? "bg-amber-500/10 text-amber-700"
                        : "bg-emerald-500/10 text-emerald-600",
                    )}
                  >
                    {isOutgoing ? (
                      <ArrowUpRightIcon className="size-3.5" />
                    ) : (
                      <ArrowDownLeftIcon className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{tx.label}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isOutgoing ? "text-amber-700" : "text-emerald-600",
                      )}
                    >
                      {tx.amount}
                    </p>
                  </div>
                  {tx.explorerUrl ? (
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View transaction on block explorer"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon-xs",
                        className: "shrink-0 text-muted-foreground",
                      })}
                    >
                      <ArrowUpRightIcon className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
        {transactions.length > 0 ? (
          <div
            aria-hidden
            className={cn(
              dashboardPanelFadeClassName,
              showBottomFade ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronDownIcon className="size-3.5 text-primary/50" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
