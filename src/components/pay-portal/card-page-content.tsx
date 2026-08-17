"use client";

import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardCardClassName } from "@/lib/dashboard-styles";

export function PayCardPageContent() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Card</h1>
        <p className="text-sm text-muted-foreground">
          Agent spending cards for in-store and online checkout.
        </p>
      </div>

      <Card className={dashboardCardClassName}>
        <CardContent className="flex min-h-[320px] items-center justify-center py-12">
          <EmptyStateLottie
            title="Coming soon"
            description="Virtual and physical cards for your linked agents are on the way."
          />
        </CardContent>
      </Card>
    </div>
  );
}
