import type { Metadata } from "next";

import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet";
import { FidenceTokenPage } from "@/components/token/payagent-token-page";

export const metadata: Metadata = {
  title: "Fidence Token",
  description: "Interact with the Fidence ERC-20 token on Sepolia testnet.",
};

export default function TokenPage() {
  return (
    <CreatePaymentLinkProvider>
      <FidenceTokenPage />
    </CreatePaymentLinkProvider>
  );
}
