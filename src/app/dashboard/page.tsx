import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PaymentLinks } from "@/components/payment-links";
import { QuickActions } from "@/components/quick-actions";
import { RecentActivity } from "@/components/recent-activity";
import { RecentTransactions } from "@/components/recent-transactions";
import { SectionCards } from "@/components/section-cards";
import { getSessionFromCookies } from "@/lib/db/auth";
import { getDashboardOverview } from "@/lib/db/dashboard";
import { ensureDbIndexes } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

export default async function Page() {
  await ensureDbIndexes();

  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in");
  }

  const overview = await getDashboardOverview(session.workspace._id);

  const user = {
    name: session.user.name,
    role: session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1),
    initials: session.user.initials,
  };

  const workspace = {
    name: session.workspace.name,
    slug: session.workspace.slug,
    paymentLink: `pay.fidence.xyz/${session.workspace.slug}`,
  };

  return (
    <AppShell title="Overview" user={user} workspace={workspace} scanQr={overview}>
      <div className="flex w-full flex-col gap-8 px-4 py-6 lg:px-8 lg:py-8">
        <SectionCards metrics={overview.metrics} />
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <RecentTransactions transactions={overview.transactions} />
          <PaymentLinks links={overview.paymentLinks} />
          <RecentActivity activities={overview.activities} />
        </div>
        <QuickActions />
      </div>
    </AppShell>
  );
}
