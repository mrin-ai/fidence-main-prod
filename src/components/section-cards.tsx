"use client"

import type { ReactNode } from "react"
import { GiftIcon } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
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
}

const stats: Stat[] = [
  { label: "Spend · June", value: "$48,250" },
  { label: "Active Agents", value: "7" },
  { label: "Pending Approvals", value: "4" },
  { label: "Success Rate", value: "99.2%" },
  { label: "Total Links", value: "5" },
  { label: "Completed", value: "5" },
  { label: "Pending", value: "3" },
  { label: "Received", value: "$640.09" },
  {
    label: "Rewards",
    value: "$1.11",
    icon: <GiftIcon className="size-3" />,
  },
]

function StatCard({ label, value, icon }: Stat) {
  return (
    <Card size="sm" className={metricCardSurfaceClassName}>
      <CardHeader className="gap-1.5 pb-0">
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
            metricCardValueClassName
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
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
