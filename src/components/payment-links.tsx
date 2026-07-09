"use client"

import Link from "next/link"
import {
  ChevronDownIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  Link2Icon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useCreatePaymentLink } from "@/components/create-payment-link-sheet"
import { EmptyStateLottie } from "@/components/empty-state-lottie"
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
import type { PaymentLinkStatus } from "@/lib/db/types"
import { useScrollFade } from "@/hooks/use-scroll-fade"
import { cn } from "@/lib/utils"

type PaymentLink = {
  id: string
  amount: string
  status: PaymentLinkStatus
  url: string
}

const paymentLinkIconClassName: Record<PaymentLinkStatus, string> = {
  paid: "bg-green-500/10 text-green-600",
  pending: "bg-amber-500/10 text-amber-600",
  expired: "bg-red-500/10 text-red-600",
  cancelled: "bg-red-500/10 text-red-600",
}

export function PaymentLinks({
  links,
  className,
}: {
  links: PaymentLink[]
  className?: string
}) {
  const { scrollRef, showBottomFade } = useScrollFade()
  const { openCreatePaymentLink } = useCreatePaymentLink()

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url)
    toast.success("Payment link copied")
  }

  return (
    <Card className={cn(dashboardCardClassName, "w-full self-start", className)}>
      <CardHeader className={dashboardPanelHeaderClassName}>
        <CardTitle className={dashboardPanelTitleClassName}>
          Payment Links
        </CardTitle>
        <CardAction className="flex items-center gap-3">
          <Link
            href="/payment-links"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
          <Button
            variant="link"
            className="h-auto gap-1 px-0 text-xs font-medium text-muted-foreground"
            onClick={openCreatePaymentLink}
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
            links.length === 0
              ? "flex items-center justify-center"
              : "flex flex-col gap-4",
          )}
        >
          {links.length === 0 ? (
            <EmptyStateLottie
              title="No payment links yet"
              description="Create a link to start collecting payments."
            />
          ) : (
            links.map((link) => (
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
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {link.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Copy link"
                  onClick={() => handleCopy(link.url)}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Open link"
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
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
                    <DropdownMenuItem onClick={() => handleCopy(link.url)}>
                      Share
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            ))
          )}
        </div>
        {links.length > 0 ? (
          <div
            aria-hidden
            className={cn(
              dashboardPanelFadeClassName,
              showBottomFade ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronDownIcon className="size-3.5 text-primary/50" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
