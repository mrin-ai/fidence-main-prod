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
import { cn } from "@/lib/utils"

type Stat = {
  label: string
  value: string
  icon?: ReactNode
  valueClassName?: string
  chartKey: string
  chartColor: string
  chartData: { value: number }[]
}

const stats: Stat[] = [
  {
    label: "Total Links",
    value: "5",
    chartKey: "links",
    chartColor: "var(--chart-1)",
    chartData: [
      { value: 2 },
      { value: 3 },
      { value: 3 },
      { value: 4 },
      { value: 4 },
      { value: 5 },
      { value: 5 },
    ],
  },
  {
    label: "Completed",
    value: "5",
    valueClassName: "text-green-600",
    chartKey: "completed",
    chartColor: "var(--chart-2)",
    chartData: [
      { value: 1 },
      { value: 2 },
      { value: 3 },
      { value: 3 },
      { value: 4 },
      { value: 4 },
      { value: 5 },
    ],
  },
  {
    label: "Pending",
    value: "3",
    valueClassName: "text-amber-600",
    chartKey: "pending",
    chartColor: "var(--chart-4)",
    chartData: [
      { value: 6 },
      { value: 5 },
      { value: 5 },
      { value: 4 },
      { value: 4 },
      { value: 3 },
      { value: 3 },
    ],
  },
  {
    label: "Received",
    value: "$651.21",
    chartKey: "received",
    chartColor: "var(--chart-1)",
    chartData: [
      { value: 420 },
      { value: 480 },
      { value: 510 },
      { value: 560 },
      { value: 590 },
      { value: 620 },
      { value: 651 },
    ],
  },
  {
    label: "Rewards",
    value: "$1.13",
    icon: <GiftIcon className="size-3" />,
    valueClassName: "text-primary",
    chartKey: "rewards",
    chartColor: "var(--chart-3)",
    chartData: [
      { value: 0.42 },
      { value: 0.58 },
      { value: 0.71 },
      { value: 0.84 },
      { value: 0.96 },
      { value: 1.05 },
      { value: 1.13 },
    ],
  },
]

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
}: Stat) {
  return (
    <Card size="sm" className={metricCardSurfaceClassName}>
      <CardHeader className="gap-1.5 pb-2">
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
            "text-xl font-semibold tracking-tight tabular-nums",
            metricCardValueClassName,
            valueClassName
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <MetricSparkline
          chartKey={chartKey}
          chartColor={chartColor}
          chartData={chartData}
        />
      </CardContent>
    </Card>
  )
}

export function SectionCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
