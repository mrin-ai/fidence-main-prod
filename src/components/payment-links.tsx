"use client"

import {
  ChevronDownIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  Link2Icon,
  PlusIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  dashboardCardClassName,
  dashboardPanelBodyHeightClassName,
  dashboardPanelFadeClassName,
  dashboardPanelHeaderClassName,
  dashboardPanelScrollClassName,
  dashboardPanelTitleClassName,
} from "@/lib/dashboard-styles"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { cn } from "@/lib/utils"

type PaymentLinkStatus = "paid" | "pending" | "expired"

type PaymentLink = {
  id: string
  amount: string
  status: PaymentLinkStatus
}

const paymentLinkIconClassName: Record<PaymentLinkStatus, string> = {
  paid: "bg-green-500/10 text-green-600",
  pending: "bg-amber-500/10 text-amber-600",
  expired: "bg-red-500/10 text-red-600",
}

const paymentLinks: PaymentLink[] = [
  { id: "1", amount: "10 USDC", status: "pending" },
  { id: "2", amount: "25 USDC", status: "paid" },
  { id: "3", amount: "50 USDC", status: "pending" },
  { id: "4", amount: "100 USDC", status: "paid" },
  { id: "5", amount: "15 USDC", status: "expired" },
  { id: "6", amount: "75 USDC", status: "pending" },
]

export function PaymentLinks({ className }: { className?: string }) {
  const { scrollRef, showBottomFade } = useScrollFade()

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Payment Links
        </CardTitle>
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
            "flex flex-col gap-4"
          )}
        >
          {paymentLinks.map((link) => (
            <div key={link.id} className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  paymentLinkIconClassName[link.status]
                )}
              >
                <Link2Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums">{link.amount}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Copy link"
                >
                  <CopyIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Open link"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        aria-label="More options"
                      />
                    }
                  >
                    <EllipsisVerticalIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Share</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
