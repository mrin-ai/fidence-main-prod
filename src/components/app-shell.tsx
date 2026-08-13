import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet"
import { OnboardingModal } from "@/components/onboarding/onboarding-modal"
import { PaymentIntentDialog } from "@/components/pay-portal/payment-intent-dialog"
import { AutoPayProcessor } from "@/components/pay-portal/auto-pay-processor"
import { ShellHeader } from "@/components/shell-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({
  title,
  user,
  workspace,
  hideSiteHeader = false,
  needsOnboarding = false,
  payEnabled = true,
  children,
}: {
  title?: string
  user: {
    name: string
    role: string
    initials: string
    username: string | null
    hasVerifiedWallet: boolean
  }
  workspace: {
    name: string
    slug: string
    paymentLink: string
  }
  hideSiteHeader?: boolean
  needsOnboarding?: boolean
  payEnabled?: boolean
  children?: ReactNode
}) {
  return (
    <CreatePaymentLinkProvider>
      {needsOnboarding ? <OnboardingModal /> : null}
      {payEnabled ? (
        <>
          <AutoPayProcessor />
          <PaymentIntentDialog />
        </>
      ) : null}
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" user={user} workspace={workspace} payEnabled={payEnabled} />
        <SidebarInset className="bg-muted/20">
          {!hideSiteHeader && <ShellHeader title={title} />}
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </CreatePaymentLinkProvider>
  )
}
