import Image from "next/image"
import { BellIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <div className="flex items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-white">
            <Image
              src="/logo.png"
              alt="Fidence"
              width={24}
              height={24}
              className="size-6 object-contain"
            />
          </div>
          <h1 className="text-sm font-medium text-foreground/80">{title}</h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="h-8 w-44 bg-background pl-8 lg:w-60"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="relative size-8 shrink-0"
            aria-label="Notifications"
          >
            <BellIcon className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>
        </div>
      </div>
    </header>
  )
}
