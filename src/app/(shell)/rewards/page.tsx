import { redirect } from "next/navigation";

import { RewardsPageContent } from "@/components/rewards/rewards-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { getRewardsOverview } from "@/lib/db/rewards";

export default async function RewardsPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/rewards");
  }

  const overview = await getRewardsOverview(
    session.user._id,
    session.workspace._id,
  );

  return <RewardsPageContent overview={overview} />;
}
