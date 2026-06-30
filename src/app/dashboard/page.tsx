import { AppShell } from "@/components/app-shell"
import { PaymentLinks } from "@/components/payment-links"
import { QuickActions } from "@/components/quick-actions"
import { RecentActivity } from "@/components/recent-activity"
import { RecentTransactions } from "@/components/recent-transactions"
import { SectionCards } from "@/components/section-cards"

export default function Page() {
  return (
    <AppShell title="Overview">
      <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
        <SectionCards />

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <RecentTransactions />
          <PaymentLinks />
          <RecentActivity />
        </div>

        <QuickActions />
      </div>
    </AppShell>
  )
}
