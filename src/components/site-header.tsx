"use client"

import { Link2Icon } from "lucide-react"

import { FidenceLogoIcon } from "@/components/fidence-logo-icon"
import { useCreatePaymentLink } from "@/components/create-payment-link-sheet"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({ title }: { title: string }) {
  const { openCreatePaymentLink } = useCreatePaymentLink()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <div className="flex items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center overflow-visible rounded-md border border-border/50 bg-white">
            <FidenceLogoIcon className="size-5" />
          </div>
          <h1 className="text-sm font-medium text-foreground/80">{title}</h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 px-3"
            onClick={openCreatePaymentLink}
          >
            <Link2Icon data-icon="inline-start" />
            Create
          </Button>
          <NotificationDropdown />
        </div>
      </div>
    </header>
  )
}
