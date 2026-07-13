import { redirect } from "next/navigation";

import { ReferralsPageContent } from "@/components/referrals/referrals-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { getReferralOverview } from "@/lib/db/referrals";

export default async function ReferralsPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/referrals");
  }

  const overview = await getReferralOverview(session.user._id);

  return <ReferralsPageContent overview={overview} />;
}
