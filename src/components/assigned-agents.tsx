"use client"

import { ChevronDownIcon, PlusIcon } from "lucide-react"

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
  agentStatusStyles,
  assignedAgents,
} from "@/lib/assigned-agents-data"
import { cn } from "@/lib/utils"

export function AssignedAgents({ className }: { className?: string }) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Assigned agents
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-3">
            <Button
              variant="link"
              className="h-auto px-0 text-xs font-medium text-muted-foreground"
            >
              View all
            </Button>
            <Button
              variant="link"
              className="h-auto gap-1 px-0 text-xs font-medium text-muted-foreground"
            >
              <PlusIcon className="size-3" />
              Assign
            </Button>
          </div>
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
          {assignedAgents.map((agent) => {
            const status = agentStatusStyles[agent.status]

            return (
              <div key={agent.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{agent.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {agent.metric}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                    status.labelClassName
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", status.dotClassName)}
                  />
                  {status.label}
                </span>
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
