"use client"

import * as React from "react"
import {
  BanIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CreditCardIcon,
  ShoppingCartIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  dashboardCardClassName,
  dashboardPanelBodyHeightClassName,
  dashboardPanelFadeClassName,
  dashboardPanelHeaderClassName,
  dashboardPanelScrollClassName,
  dashboardPanelTitleClassName,
} from "@/lib/dashboard-styles"
import { cn } from "@/lib/utils"

type ActivityStatus = "settled" | "blocked"

type ActivityItem = {
  id: string
  icon: React.ReactNode
  iconClassName: string
  summary: React.ReactNode
  meta: string
  status?: ActivityStatus
}

const activities: ActivityItem[] = [
  {
    id: "1",
    icon: <ShoppingCartIcon className="size-3.5" />,
    iconClassName: "bg-accent/70 text-primary",
    summary: (
      <>
        <span className="font-medium">Shopping Agent</span> spent{" "}
        <span className="font-medium">$2,199</span> at Apple
      </>
    ),
    meta: "2m ago · approved",
    status: "settled",
  },
  {
    id: "2",
    icon: <BanIcon className="size-3.5" />,
    iconClassName: "bg-destructive/8 text-destructive",
    summary: (
      <>
        <span className="font-medium">Trading Bot</span> blocked on Unknown DEX
      </>
    ),
    meta: "6m ago · not on safelist",
    status: "blocked",
  },
  {
    id: "3",
    icon: <CircleCheckIcon className="size-3.5" />,
    iconClassName: "bg-secondary text-secondary-foreground",
    summary: (
      <>
        <span className="font-medium">Cloud Agent</span> approved AWS spend
      </>
    ),
    meta: "12m ago · 1 of 1 approvals",
  },
  {
    id: "4",
    icon: <CreditCardIcon className="size-3.5" />,
    iconClassName: "bg-secondary text-primary",
    summary: (
      <>
        Wallet funded with <span className="font-medium">$5,000 USDC</span>
      </>
    ),
    meta: "1h ago · identity verified",
  },
  {
    id: "5",
    icon: <ShoppingCartIcon className="size-3.5" />,
    iconClassName: "bg-accent/70 text-primary",
    summary: (
      <>
        <span className="font-medium">Shopping Agent</span> spent{" "}
        <span className="font-medium">$129</span> at Notion
      </>
    ),
    meta: "2h ago · auto-approved",
    status: "settled",
  },
  {
    id: "6",
    icon: <BanIcon className="size-3.5" />,
    iconClassName: "bg-destructive/8 text-destructive",
    summary: (
      <>
        <span className="font-medium">Trading Bot</span> blocked on unverified
        pool
      </>
    ),
    meta: "3h ago · risk threshold",
    status: "blocked",
  },
]

function ActivityStatusDot({ status }: { status: ActivityStatus }) {
  return (
    <span
      className={cn(
        "mt-1 size-1.5 shrink-0 rounded-full",
        status === "settled" ? "bg-green-500" : "bg-red-500"
      )}
    />
  )
}

export function RecentActivity({ className }: { className?: string }) {
  const [showBottomFade, setShowBottomFade] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const updateScrollFade = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const hasOverflow = el.scrollHeight > el.clientHeight + 1
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    setShowBottomFade(hasOverflow && !atBottom)
  }, [])

  React.useEffect(() => {
    updateScrollFade()

    const el = scrollRef.current
    if (!el) return

    el.addEventListener("scroll", updateScrollFade, { passive: true })
    window.addEventListener("resize", updateScrollFade)

    return () => {
      el.removeEventListener("scroll", updateScrollFade)
      window.removeEventListener("resize", updateScrollFade)
    }
  }, [updateScrollFade])

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Recent activity
        </CardTitle>
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
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  activity.iconClassName
                )}
              >
                {activity.icon}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-snug text-foreground/90">
                  {activity.summary}
                </p>
                <p className="font-mono text-[0.6875rem] text-muted-foreground">
                  {activity.meta}
                </p>
              </div>
              {activity.status ? (
                <ActivityStatusDot status={activity.status} />
              ) : null}
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
