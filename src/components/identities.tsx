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
import { identities } from "@/lib/identities-data"
import { cn } from "@/lib/utils"

export function Identities({ className }: { className?: string }) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>Identities</CardTitle>
        <CardAction>
          <Button
            variant="link"
            className="h-auto gap-1 px-0 text-xs font-medium text-muted-foreground"
          >
            <PlusIcon className="size-3" />
            New
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="relative pt-0">
        <div
          ref={scrollRef}
          className={cn(
            dashboardPanelBodyHeightClassName,
            dashboardPanelScrollClassName,
            "divide-y divide-border"
          )}
        >
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-[0.6875rem] font-semibold",
                  identity.avatarClassName
                )}
              >
                {identity.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{identity.name}</p>
                <p className="text-xs text-muted-foreground">
                  {identity.agents} {identity.agents === 1 ? "agent" : "agents"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">
                {identity.amount}
              </p>
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
