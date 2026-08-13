"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { GiftIcon } from "lucide-react"
import { Area, AreaChart } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  metricCardLabelClassName,
  metricCardSurfaceClassName,
  metricCardValueClassName,
} from "@/lib/dashboard-styles"
import type { DashboardOverview } from "@/lib/db/types"
import { cn } from "@/lib/utils"

type Stat = {
  label: string
  value: string
  icon?: ReactNode
  valueClassName?: string
  chartKey: string
  chartColor: string
  chartData: { value: number }[]
  comingSoon?: boolean
}

function buildStats(metrics: DashboardOverview["metrics"]): Stat[] {
  return [
    {
      label: "Total Links",
      value: String(metrics.totalLinks),
      chartKey: "links",
      chartColor: "var(--chart-1)",
      chartData: metrics.sparklines.links.map((value) => ({ value })),
    },
    {
      label: "Completed",
      value: String(metrics.completedLinks),
      valueClassName: "text-green-600",
      chartKey: "completed",
      chartColor: "var(--chart-2)",
      chartData: metrics.sparklines.completed.map((value) => ({ value })),
    },
    {
      label: "Pending",
      value: String(metrics.pendingLinks),
      valueClassName: "text-amber-600",
      chartKey: "pending",
      chartColor: "var(--chart-4)",
      chartData: metrics.sparklines.pending.map((value) => ({ value })),
    },
    {
      label: "Received",
      value: `$${metrics.receivedAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      chartKey: "received",
      chartColor: "var(--chart-1)",
      chartData: metrics.sparklines.received.map((value) => ({ value })),
    },
    {
      label: "Rewards",
      value: "Soon",
      icon: <GiftIcon className="size-3" />,
      valueClassName: "text-sm font-medium text-muted-foreground",
      chartKey: "rewards",
      chartColor: "var(--chart-3)",
      chartData: [],
      comingSoon: true,
    },
  ]
}

function MetricSparkline({
  chartKey,
  chartColor,
  chartData,
}: Pick<Stat, "chartKey" | "chartColor" | "chartData">) {
  const gradientId = React.useId().replace(/:/g, "")
  const config = {
    [chartKey]: {
      label: chartKey,
      color: chartColor,
    },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-11 w-full opacity-90 transition-opacity group-hover/metric:opacity-100 [&_.recharts-cartesian-axis]:hidden [&_.recharts-cartesian-grid]:hidden"
      initialDimension={{ width: 240, height: 44 }}
    >
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${chartKey})`} stopOpacity={0.35} />
            <stop offset="100%" stopColor={`var(--color-${chartKey})`} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={`var(--color-${chartKey})`}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function StatCard({
  label,
  value,
  icon,
  valueClassName,
  chartKey,
  chartColor,
  chartData,
  comingSoon = false,
}: Stat) {
  return (
    <Card size="sm" className={metricCardSurfaceClassName}>
      <CardHeader className={cn("gap-1.5 pb-2", comingSoon && "pb-4")}>
        <p
          className={cn(
            "flex items-center gap-1 text-xs",
            metricCardLabelClassName
          )}
        >
          {icon}
          {label}
        </p>
        <CardTitle
          className={cn(
            comingSoon
              ? "text-sm font-medium"
              : "text-xl font-semibold tracking-tight tabular-nums",
            metricCardValueClassName,
            valueClassName
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {!comingSoon ? (
        <CardContent className="px-4 pb-3 pt-0">
          <MetricSparkline
            chartKey={chartKey}
            chartColor={chartColor}
            chartData={chartData}
          />
        </CardContent>
      ) : (
        <CardContent className="px-4 pb-3 pt-0" aria-hidden>
          <div className="h-11" />
        </CardContent>
      )}
    </Card>
  )
}

export function SectionCards({
  metrics,
}: {
  metrics: DashboardOverview["metrics"]
}) {
  const stats = buildStats(metrics)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
