export type AgentStatus = "active" | "paused"

export type AssignedAgent = {
  id: string
  name: string
  metric: string
  status: AgentStatus
}

export const assignedAgents: AssignedAgent[] = [
  {
    id: "1",
    name: "Shopping Agent",
    metric: "$312 / $500 today",
    status: "active",
  },
  {
    id: "2",
    name: "Pricing Bot",
    metric: "$0 / $1,000 today",
    status: "active",
  },
  {
    id: "3",
    name: "Support Agent",
    metric: "refunds · $120 / day",
    status: "active",
  },
  {
    id: "4",
    name: "Compliance Agent",
    metric: "policy checks · 24 / day",
    status: "paused",
  },
  {
    id: "5",
    name: "Reconciliation Agent",
    metric: "$4.2k / $5k today",
    status: "active",
  },
  {
    id: "6",
    name: "Notification Agent",
    metric: "webhooks · 18 / hour",
    status: "paused",
  },
]

export const agentStatusStyles: Record<
  AgentStatus,
  { dotClassName: string; labelClassName: string; label: string }
> = {
  active: {
    dotClassName: "bg-green-500",
    labelClassName: "text-green-600",
    label: "Active",
  },
  paused: {
    dotClassName: "bg-amber-500",
    labelClassName: "text-amber-600",
    label: "Paused",
  },
}
