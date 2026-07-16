import type { Metadata } from "next";

import { StackgridPage } from "@/components/StackgridPage";
import { getStackgridHomeHtml } from "@/lib/stackgrid-home";

export const metadata: Metadata = {
  title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
  description:
    "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Instant Crypto Payments – Low Fees + AI Agent Payment API",
    description:
      "Accept instant crypto payments with low transaction fees. Simple for humans and merchants, with an AI agent payment API for autonomous commerce.",
    url: "https://www.payagent.co",
    images: ["https://www.payagent.co/payagent-og.png"],
  },
};

export default function HomePage() {
  const html = getStackgridHomeHtml();
  return <StackgridPage html={html} />;
}
