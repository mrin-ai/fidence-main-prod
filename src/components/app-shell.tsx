import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  title,
  user,
  workspace,
  hideSiteHeader = false,
  children,
}: {
  title: string
  user: {
    name: string
    role: string
    initials: string
  }
  workspace: {
    name: string
    slug: string
    paymentLink: string
  }
  hideSiteHeader?: boolean
  children?: ReactNode
}) {
  return (
    <CreatePaymentLinkProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" user={user} workspace={workspace} />
        <SidebarInset className="bg-muted/20">
          {!hideSiteHeader && <SiteHeader title={title} />}
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </CreatePaymentLinkProvider>
  )
}
