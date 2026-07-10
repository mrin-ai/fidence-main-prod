import { redirect } from "next/navigation";

import { TransactionsPageContent } from "@/components/transactions/transactions-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  listWorkspaceTransactions,
  TRANSACTIONS_PAGE_LIMIT,
} from "@/lib/db/transactions-feed";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/transactions");
  }

  const { page: pageParam } = await searchParams;
  const requestedPage = Number(pageParam ?? "1");
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

  const feed = await listWorkspaceTransactions(session.workspace._id, {
    page,
    limit: TRANSACTIONS_PAGE_LIMIT,
  });

  if (page > feed.totalPages) {
    const redirectUrl =
      feed.totalPages <= 1
        ? "/transactions"
        : `/transactions?page=${feed.totalPages}`;
    redirect(redirectUrl);
  }

  return <TransactionsPageContent feed={feed} />;
}
