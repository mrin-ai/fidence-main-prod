import { notFound } from "next/navigation";

import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet";
import { ProfilePaymentCheckout } from "@/components/pay/profile-payment-checkout";
import { getPublicProfileByUsername } from "@/lib/db/public-profile";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  if (isReservedPaymentPathSegment(username)) {
    notFound();
  }

  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  return (
    <CreatePaymentLinkProvider>
      <ProfilePaymentCheckout profile={profile} />
    </CreatePaymentLinkProvider>
  );
}
