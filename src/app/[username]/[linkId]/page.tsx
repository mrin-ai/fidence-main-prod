import { notFound } from "next/navigation";

import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet";
import { PaymentLinkCheckout } from "@/components/pay/payment-link-checkout";
import { getPaymentLinkByUsernameAndPublicId } from "@/lib/db/payment-links";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";

export const revalidate = 60;
export default async function PublicPaymentLinkPage({
  params,
}: {
  params: Promise<{ username: string; linkId: string }>;
}) {
  const { username, linkId } = await params;

  if (isReservedPaymentPathSegment(username)) {
    notFound();
  }

  const link = await getPaymentLinkByUsernameAndPublicId(username, linkId);

  if (!link) {
    notFound();
  }

  return (
    <CreatePaymentLinkProvider>
      <PaymentLinkCheckout initialLink={link} />
    </CreatePaymentLinkProvider>
  );
}
