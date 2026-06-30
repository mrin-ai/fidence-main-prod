import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet"
import { ScanQrProvider } from "@/components/scan-qr-drawer"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <CreatePaymentLinkProvider>
      <ScanQrProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset className="bg-muted/20">
            <SiteHeader title={title} />
            <div className="flex flex-1 flex-col">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </ScanQrProvider>
    </CreatePaymentLinkProvider>
  )
}
