import type { Metadata } from "next";

import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet";
import { LeaderboardContent } from "@/components/leaderboard/leaderboard-content";
import { PayPageNavbar } from "@/components/pay/pay-page-navbar";
import { getAgentLeaderboard } from "@/lib/db/agent-leaderboard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Agent Leaderboard",
  description:
    "Public leaderboard of PayAgent agents ranked by total on-chain payment volume.",
};

export default async function LeaderboardPage() {
  const leaderboard = await getAgentLeaderboard();

  return (
    <CreatePaymentLinkProvider>
      <div className="lcx-auth flex min-h-full flex-col bg-background">
        <PayPageNavbar />
        <LeaderboardContent leaderboard={leaderboard} />
      </div>
    </CreatePaymentLinkProvider>
  );
}
