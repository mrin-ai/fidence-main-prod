export type BalanceStatus = "active" | "paused"

export type BalanceItem = {
  id: string
  label: string
  value: string
  status?: BalanceStatus
}

export const balances: BalanceItem[] = [
  { id: "1", label: "USDC · Base", value: "8,400.00" },
  { id: "2", label: "USDC · Ethereum", value: "3,200.00" },
  { id: "3", label: "USDC · Arbitrum", value: "1,250.00" },
  { id: "4", label: "USDC · Polygon", value: "890.50" },
  { id: "5", label: "Ethereum", value: "2.10" },
  { id: "6", label: "Solana", value: "64.0" },
  { id: "7", label: "Bitcoin", value: "0.42" },
  { id: "8", label: "USDT · Tron", value: "5,100.00" },
  { id: "9", label: "Avalanche", value: "18.5" },
  { id: "10", label: "•••• 4242", value: "active", status: "active" },
]

export const balanceStatusStyles: Record<
  BalanceStatus,
  { className: string; label: string }
> = {
  active: {
    className: "text-green-600",
    label: "active",
  },
  paused: {
    className: "text-amber-600",
    label: "paused",
  },
}
