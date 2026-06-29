"use client"

import * as React from "react"
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
import { cn } from "@/lib/utils"

type ApprovalItem = {
  id: string
  title: string
  amount: string
  meta: string
}

const initialItems: ApprovalItem[] = [
  {
    id: "1",
    title: "MacBook Pro",
    amount: "$2,199",
    meta: "Shopping Agent · Apple",
  },
  {
    id: "2",
    title: "AWS · Infra",
    amount: "$840",
    meta: "Cloud Agent · Engineering",
  },
  {
    id: "3",
    title: "Slack Enterprise",
    amount: "$1,200",
    meta: "Ops Agent · slack.com",
  },
  {
    id: "4",
    title: "Figma Team",
    amount: "$540",
    meta: "Design Agent · figma.com",
  },
  {
    id: "5",
    title: "Datadog",
    amount: "$320",
    meta: "Cloud Agent · datadoghq.com",
  },
]

export function NeedsApproval({ className }: { className?: string }) {
  const [items, setItems] = React.useState(initialItems)
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
  }, [items, updateScrollFade])

  function handleApprove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  function handleReject(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Needs approval
        </CardTitle>
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
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            All caught up — nothing pending approval.
          </p>
        ) : (
          <>
            <div
              ref={scrollRef}
              className={cn(
                dashboardPanelBodyHeightClassName,
                dashboardPanelScrollClassName,
                "flex flex-col gap-4"
              )}
            >
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-snug">
                        {item.title}
                      </p>
                      <p className="font-mono text-[0.6875rem] text-muted-foreground">
                        {item.meta}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums">
                      {item.amount}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => handleApprove(item.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-muted-foreground"
                      onClick={() => handleReject(item.id)}
                    >
                      Reject
                    </Button>
                  </div>
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
          </>
        )}
      </CardContent>
    </Card>
  )
}
