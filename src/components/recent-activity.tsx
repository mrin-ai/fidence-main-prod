"use client"

import * as React from "react"
import {
  BanIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  LinkIcon,
  LogInIcon,
  LogOutIcon,
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
import type { ActivityStatus } from "@/lib/db/types"
import { cn } from "@/lib/utils"

type ActivityItem = {
  id: string
  summary: string
  meta: string
  status?: ActivityStatus
  type: string
}

function getActivityVisual(type: string, status?: ActivityStatus) {
  if (type === "login") {
    return {
      icon: <LogInIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    }
  }

  if (type === "logout") {
    return {
      icon: <LogOutIcon className="size-3.5" />,
      iconClassName: "bg-muted text-muted-foreground",
    }
  }

  if (type === "payment_link_created") {
    return {
      icon: <LinkIcon className="size-3.5" />,
      iconClassName: "bg-accent/70 text-primary",
    }
  }

  if (type === "payment_received") {
    return {
      icon: <CircleCheckIcon className="size-3.5" />,
      iconClassName: "bg-green-500/10 text-green-600",
    }
  }

  if (type === "invoice_created") {
    return {
      icon: <FileTextIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-secondary-foreground",
    }
  }

  if (status === "blocked" || type === "blocked") {
    return {
      icon: <BanIcon className="size-3.5" />,
      iconClassName: "bg-destructive/8 text-destructive",
    }
  }

  if (type === "wallet_funded") {
    return {
      icon: <CreditCardIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    }
  }

  if (type === "approval") {
    return {
      icon: <CircleCheckIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-secondary-foreground",
    }
  }

  return {
    icon: <ShoppingCartIcon className="size-3.5" />,
    iconClassName: "bg-accent/70 text-primary",
  }
}

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
          {activities.map((activity) => {
            const visual = getActivityVisual(activity.type, activity.status)

            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    visual.iconClassName
                  )}
                >
                  {visual.icon}
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
            )
          })}
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
