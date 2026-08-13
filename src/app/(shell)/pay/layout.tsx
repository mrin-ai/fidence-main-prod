import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PayTabsNav } from "@/components/pay-portal/pay-tabs-nav";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";

export default function PayLayout({ children }: { children: ReactNode }) {
  if (!isPayAgentConnectEnabled()) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PayTabsNav />
      {children}
    </div>
  );
}
