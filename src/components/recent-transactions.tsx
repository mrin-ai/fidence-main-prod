"use client"

import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
          <Button
            variant="link"
            className="h-auto gap-1 px-0 text-xs font-medium text-muted-foreground"
          >
            View All
            <ArrowUpRightIcon className="size-3" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div
          ref={scrollRef}
          className={cn(
            dashboardPanelBodyHeightClassName,
            dashboardPanelScrollClassName,
            "flex flex-col gap-4"
          )}
        >
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ArrowDownLeftIcon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{tx.label}</p>
                <p className="text-xs text-muted-foreground">{tx.date}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-emerald-600">
                  {tx.amount}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                aria-label="Open transaction"
              >
                <ArrowUpRightIcon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div
          aria-hidden
          className={cn(
            dashboardPanelFadeClassName,
            showBottomFade ? "opacity-100" : "opacity-0"
          )}
        >
          <ChevronDownIcon className="size-3.5 text-primary/50" />
        </div>
      </CardContent>
    </Card>
  )
}
