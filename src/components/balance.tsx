"use client"

import { ChevronDownIcon } from "lucide-react"

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
import {
  balanceStatusStyles,
  balances,
} from "@/lib/balance-data"
import { cn } from "@/lib/utils"

export function Balance({ className }: { className?: string }) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>Balance</CardTitle>
        <CardAction>
          <Button
            variant="link"
            className="h-auto px-0 text-xs font-medium text-muted-foreground"
          >
            View all
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
          {balances.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
                {item.label}
              </p>
              {item.status ? (
                <p
                  className={cn(
                    "shrink-0 text-sm font-medium",
                    balanceStatusStyles[item.status].className
                  )}
                >
                  {balanceStatusStyles[item.status].label}
                </p>
              ) : (
                <p className="shrink-0 text-sm font-medium tabular-nums">
                  {item.value}
                </p>
              )}
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
