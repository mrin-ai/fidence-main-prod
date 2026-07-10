import { TransactionList } from "@/components/transactions/transaction-list";
import {
  TransactionsPageSummary,
  TransactionsPagination,
} from "@/components/transactions/transactions-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransactionListItem } from "@/lib/db/transactions-feed";

export function TransactionsPageContent({
  feed,
}: {
  feed: {
    items: TransactionListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Payments sent and received across your workspace.
        </p>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">All transactions</CardTitle>
          <TransactionsPageSummary
            page={feed.page}
            limit={feed.limit}
            total={feed.total}
            totalPages={feed.totalPages}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <TransactionList transactions={feed.items} />
          <TransactionsPagination page={feed.page} totalPages={feed.totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
