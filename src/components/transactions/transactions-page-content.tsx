"use client";

import { useRouter } from "next/navigation";

import { CommerceSourceToggle } from "@/components/merchant/commerce-source-toggle";
import { TransactionList } from "@/components/transactions/transaction-list";
import {
  TransactionsPageSummary,
  TransactionsPagination,
} from "@/components/transactions/transactions-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransactionListItem } from "@/lib/db/transactions-feed";
import type { CommerceSource } from "@/lib/db/merchant-types";

export function TransactionsPageContent({
  feed,
  source,
}: {
  feed: {
    items: TransactionListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  source: CommerceSource;
}) {
  const router = useRouter();

  function handleSourceChange(nextSource: CommerceSource) {
    const params = new URLSearchParams();
    if (nextSource === "agent") {
      params.set("source", "agent");
    }
    const query = params.toString();
    router.push(query ? `/transactions?${query}` : "/transactions");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Transactions</h2>
          <p className="text-sm text-muted-foreground">
            {source === "agent"
              ? "Payments made or received by registered agents."
              : "Payments sent and received across your workspace."}
          </p>
        </div>
        <CommerceSourceToggle value={source} onChange={handleSourceChange} />
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            {source === "agent" ? "Agent transactions" : "Human transactions"}
          </CardTitle>
          <TransactionsPageSummary
            page={feed.page}
            limit={feed.limit}
            total={feed.total}
            totalPages={feed.totalPages}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <TransactionList transactions={feed.items} source={source} />
          <TransactionsPagination page={feed.page} totalPages={feed.totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
