import { PaymentLinks } from "@/components/payment-links";
import { QuickActions } from "@/components/quick-actions";
import { RecentActivity } from "@/components/recent-activity";
import { RecentTransactions } from "@/components/recent-transactions";
import { SectionCards } from "@/components/section-cards";
import { getDashboardOverview } from "@/lib/db/dashboard";
import { requireShellSession } from "@/lib/shell-session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { session } = await requireShellSession("/dashboard");
  const overview = await getDashboardOverview(session.workspace._id);

  return (
    <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
      <SectionCards metrics={overview.metrics} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <RecentTransactions transactions={overview.transactions} />
        <PaymentLinks links={overview.paymentLinks} />
        <RecentActivity activities={overview.activities} />
      </div>
      <QuickActions />
    </div>
  );
}
