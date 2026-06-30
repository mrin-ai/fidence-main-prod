"use client"

import { UsersIcon } from "lucide-react"

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
  dashboardPanelHeaderClassName,
  dashboardPanelTitleClassName,
} from "@/lib/dashboard-styles"
import { cn } from "@/lib/utils"

export function Identities({ className }: { className?: string }) {
  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>Identities</CardTitle>
        <CardAction>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
            Soon
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className={cn(
            dashboardPanelBodyHeightClassName,
            "flex flex-col justify-between gap-6 rounded-lg border border-dashed border-border/60 bg-secondary/30 p-5"
          )}
        >
          <div className="flex flex-col items-center gap-3 pt-4 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <UsersIcon className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Identity management coming soon</p>
              <p className="max-w-[15rem] text-xs leading-relaxed text-muted-foreground">
                Create identities, assign agents, and manage spending policies from
                one place.
              </p>
            </div>
          </div>

          <div aria-hidden className="space-y-3 opacity-35">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="size-8 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-24 rounded bg-muted" />
                  <div className="h-2 w-16 rounded bg-muted" />
                </div>
                <div className="h-2.5 w-10 shrink-0 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
