import { PaymentLinksPageContent } from "@/components/payment-links-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { listPaymentLinksForWorkspace } from "@/lib/db/payment-links";

export const dynamic = "force-dynamic";

export default async function PaymentLinksPage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const links = await listPaymentLinksForWorkspace(session.workspace._id);

  return <PaymentLinksPageContent initialLinks={links} />;
}
