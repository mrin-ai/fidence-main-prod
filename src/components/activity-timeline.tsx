"use client"

import { ChevronDownIcon } from "lucide-react"

import {
  Card,
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
import { activityTimeline } from "@/lib/activity-timeline-data"
import { cn } from "@/lib/utils"

export function ActivityTimeline({ className }: { className?: string }) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Activity timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div
          ref={scrollRef}
          className={cn(
            dashboardPanelBodyHeightClassName,
            dashboardPanelScrollClassName,
            "relative pl-4"
          )}
        >
          <div
            aria-hidden
            className="absolute top-2 bottom-2 left-[3px] w-px bg-border"
          />
          <div className="flex flex-col gap-5">
            {activityTimeline.map((entry) => (
              <div key={entry.id} className="relative flex gap-3">
                <div
                  className={cn(
                    "absolute -left-4 top-1.5 size-2 shrink-0 rounded-full",
                    entry.dotClassName
                  )}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm leading-snug text-foreground/90">
                    {entry.parts.map((part, index) =>
                      part.bold ? (
                        <span key={index} className="font-medium">
                          {part.text}
                        </span>
                      ) : (
                        <span key={index}>{part.text}</span>
                      )
                    )}
                  </p>
                  <p className="font-mono text-[0.6875rem] text-muted-foreground">
                    {entry.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
