import { PaymentLinksPageContent } from "@/components/payment-links-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listPaymentLinksPaginated } from "@/lib/db/payment-links";

export const dynamic = "force-dynamic";

export default async function PaymentLinksPage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const feed = await listPaymentLinksPaginated(session.workspace._id, {
    page: 1,
    limit: 20,
    source: "human",
  });

  return <PaymentLinksPageContent initialLinks={feed.items} />;
}
