"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDownIcon } from "lucide-react"

import {
  ActivityList,
  type ActivityItem,
} from "@/components/activity/activity-list"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyStateLottie } from "@/components/empty-state-lottie"
import {
  dashboardCardClassName,
  dashboardPanelBodyHeightClassName,
  dashboardPanelFadeClassName,
  dashboardPanelHeaderClassName,
  dashboardPanelScrollClassName,
  dashboardPanelTitleClassName,
} from "@/lib/dashboard-styles"
import { cn } from "@/lib/utils"

export function RecentActivity({
  activities,
  className,
}: {
  activities: ActivityItem[]
  className?: string
}) {
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
  }, [updateScrollFade, activities.length])

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Recent activity
        </CardTitle>
        {activities.length > 0 ? (
          <CardAction>
            <Link
              href="/activity"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="relative pt-0">
        <div
          ref={scrollRef}
          className={cn(
            dashboardPanelBodyHeightClassName,
            dashboardPanelScrollClassName,
            activities.length === 0
              ? "flex items-center justify-center"
              : undefined,
          )}
        >
          {activities.length === 0 ? (
            <EmptyStateLottie
              title="No activity yet"
              description="Logins, payments, invoices, and wallets will show up here."
            />
          ) : (
            <ActivityList activities={activities} />
          )}
        </div>
        {activities.length > 0 ? (
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
