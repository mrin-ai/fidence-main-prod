import { AppShell } from "@/components/app-shell"
import { ChartBarDefault } from "@/components/chart-bar-default"
import { Identities } from "@/components/identities"
import { NeedsApproval } from "@/components/needs-approval"
import { PaymentLinks } from "@/components/payment-links"
import { QuickActions } from "@/components/quick-actions"
import { RecentActivity } from "@/components/recent-activity"
import { RecentTransactions } from "@/components/recent-transactions"

export default function Page() {
  return (
    <AppShell title="Overview">
      <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
        <div className="grid items-start gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <ChartBarDefault />
          </div>
          <div className="xl:col-span-3">
            <NeedsApproval />
          </div>
          <div className="xl:col-span-5">
            <RecentActivity />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:col-span-12 xl:grid-cols-3">
            <RecentTransactions />
            <PaymentLinks />
            <Identities />
          </div>
        </div>
        <QuickActions />
      </div>
    </AppShell>
  )
}
