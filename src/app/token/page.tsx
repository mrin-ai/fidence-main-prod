import type { Metadata } from "next";

import { CreatePaymentLinkProvider } from "@/components/create-payment-link-sheet";
import { PayagentTokenPage } from "@/components/token/payagent-token-page";

export const metadata: Metadata = {
  title: "PAYAGENT Token",
  description: "Interact with the PAYAGENT ERC-20 token on Sepolia testnet.",
};

export default function TokenPage() {
  return (
    <CreatePaymentLinkProvider>
      <PayagentTokenPage />
    </CreatePaymentLinkProvider>
  );
}
