import { Suspense } from "react";

import { PayConnectPageContent } from "@/components/pay-portal/connect-page-content";

export const dynamic = "force-dynamic";

export default function PayConnectPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <PayConnectPageContent />
    </Suspense>
  );
}
