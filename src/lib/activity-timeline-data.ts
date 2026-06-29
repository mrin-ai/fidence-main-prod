export type TimelineEntryPart = {
  text: string
  bold?: boolean
}

export type TimelineEntry = {
  id: string
  dotClassName: string
  parts: TimelineEntryPart[]
  meta: string
}

export const activityTimeline: TimelineEntry[] = [
  {
    id: "1",
    dotClassName: "bg-purple-500",
    parts: [
      { text: "Shopping Agent settled " },
      { text: "$2,199", bold: true },
      { text: " · Apple" },
    ],
    meta: "10:41 · Visa · approved by Alex",
  },
  {
    id: "2",
    dotClassName: "bg-lime-400",
    parts: [
      { text: "Policy " },
      { text: "Retail v3", bold: true },
      { text: " updated · cap raised to $500" },
    ],
    meta: "09:12 · by Alex Rivera",
  },
  {
    id: "3",
    dotClassName: "bg-primary",
    parts: [
      { text: "Connected " },
      { text: "USDC on Base", bold: true },
    ],
    meta: "Yesterday · token active",
  },
  {
    id: "4",
    dotClassName: "bg-teal-500",
    parts: [
      { text: "Pricing Bot updated " },
      { text: "rate limits", bold: true },
      { text: " · max $1,000/day" },
    ],
    meta: "Yesterday · by system",
  },
  {
    id: "5",
    dotClassName: "bg-amber-500",
    parts: [
      { text: "Support Agent paused on " },
      { text: "refunds", bold: true },
    ],
    meta: "Mon · manual review",
  },
  {
    id: "6",
    dotClassName: "bg-chart-2",
    parts: [
      { text: "Added " },
      { text: "Ethereum", bold: true },
      { text: " payment account" },
    ],
    meta: "Sun · wallet verified",
  },
]
