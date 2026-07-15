"use client";

import { CircleCheckIcon, ExternalLinkIcon, InfoIcon, TrophyIcon } from "lucide-react";
import { useReadContract } from "wagmi";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentLeaderboard, AgentLeaderboardTxn } from "@/lib/db/agent-leaderboard";
import {
  PAYAGENT_ORACLE_ABI,
  PAYAGENT_ORACLE_ADDRESS,
  tokenUsdValue,
} from "@/lib/payagent-oracle";
import { PAYAGENT_TOKEN_CHAIN } from "@/lib/payagent-token";
import { truncateAddress } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

const TABLE_CELL = "px-3";
const TABLE_NUMERIC = "px-3 text-right";

function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatAsOf(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rankBadgeClassName(rank: number) {
  if (rank === 1) return "bg-amber-500/15 text-amber-700 border-amber-500/20";
  if (rank === 2) return "bg-slate-500/10 text-slate-700 border-slate-500/20";
  if (rank === 3) return "bg-orange-500/10 text-orange-700 border-orange-500/20";
  return "";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <Badge
        variant="outline"
        className={cn("size-7 justify-center rounded-full p-0 tabular-nums", rankBadgeClassName(rank))}
      >
        {rank}
      </Badge>
    );
  }

  return (
    <span className="inline-flex size-7 items-center justify-center text-sm tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
      >
        <CircleCheckIcon data-icon="inline-start" />
        Verified
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="secondary" className="cursor-default">
            <InfoIcon data-icon="inline-start" />
            Unverified
          </Badge>
        }
      />
      <TooltipContent>Request for verification</TooltipContent>
    </Tooltip>
  );
}

function OnChainTxLinks({ transactions }: { transactions: AgentLeaderboardTxn[] }) {
  if (transactions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {transactions.map((transaction) =>
        transaction.explorerUrl ? (
          <a
            key={transaction.txHash}
            href={transaction.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
          >
            {truncateAddress(transaction.txHash, 4)}
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : (
          <span
            key={transaction.txHash}
            className="font-mono text-xs text-muted-foreground"
          >
            {truncateAddress(transaction.txHash, 4)}
          </span>
        ),
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string;
  value: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl tabular-nums",
            highlight && "text-primary",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function LeaderboardContent({
  leaderboard,
}: {
  leaderboard: AgentLeaderboard;
}) {
  const { summary, rows } = leaderboard;

  const { data: oraclePrice, isLoading: isLoadingOraclePrice } = useReadContract({
    address: PAYAGENT_ORACLE_ADDRESS,
    abi: PAYAGENT_ORACLE_ABI,
    functionName: "latestPrice",
    chainId: PAYAGENT_TOKEN_CHAIN.id,
  });

  const totalVolumeUsd = tokenUsdValue(summary.totalValue, oraclePrice);

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-8">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Agent Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Top agents ranked by total on-chain payment volume.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total volume transacted"
            value={
              isLoadingOraclePrice
                ? "…"
                : totalVolumeUsd ?? "—"
            }
            highlight
            description="Confirmed on-chain payment volume in USD"
          />
          <SummaryCard
            label="Total transactions"
            value={summary.totalTxns.toLocaleString("en-US")}
            description="Unique agent-attributed txns"
          />
          <SummaryCard
            label="Agents live now"
            value={summary.activeAgents.toLocaleString("en-US")}
            description="Active registered agents"
          />
        </div>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-2">
              <TrophyIcon className="size-4 text-muted-foreground" />
              <CardTitle>Top agents</CardTitle>
            </div>
            <CardDescription>
              Ranked by combined sent and received volume.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No agents on the leaderboard yet.
              </p>
            ) : (
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TABLE_CELL}>Rank</TableHead>
                    <TableHead className={TABLE_CELL}>Agent ID</TableHead>
                    <TableHead className={TABLE_NUMERIC}>Volume</TableHead>
                    <TableHead className={TABLE_NUMERIC}>Links paid</TableHead>
                    <TableHead className={TABLE_NUMERIC}>Received</TableHead>
                    <TableHead className={TABLE_NUMERIC}>Sent</TableHead>
                    <TableHead className={TABLE_CELL}>Verified</TableHead>
                    <TableHead className={TABLE_CELL}>Status</TableHead>
                    <TableHead className={TABLE_CELL}>On-chain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.publicId}
                      className={cn(
                        row.rank <= 3 && "bg-muted/30",
                      )}
                    >
                      <TableCell className={TABLE_CELL}>
                        <RankBadge rank={row.rank} />
                      </TableCell>
                      <TableCell className={TABLE_CELL}>
                        <Badge variant="outline" className="max-w-full truncate font-mono font-normal">
                          {row.publicId}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(TABLE_NUMERIC, "font-medium tabular-nums")}>
                        {formatAmount(row.totalValue)}
                      </TableCell>
                      <TableCell className={cn(TABLE_NUMERIC, "tabular-nums")}>
                        <span className="font-medium">{row.linksPaid}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {row.linksCreated}
                        </span>
                      </TableCell>
                      <TableCell className={TABLE_NUMERIC}>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                        >
                          +{formatAmount(row.amountReceived)}
                        </Badge>
                      </TableCell>
                      <TableCell className={TABLE_NUMERIC}>
                        <Badge
                          variant="outline"
                          className="border-amber-500/20 bg-amber-500/10 text-amber-700"
                        >
                          -{formatAmount(row.amountPaid)}
                        </Badge>
                      </TableCell>
                      <TableCell className={TABLE_CELL}>
                        <VerificationBadge verified={row.verified} />
                      </TableCell>
                      <TableCell className={TABLE_CELL}>
                        <Badge
                          variant={row.status === "active" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={TABLE_CELL}>
                        <OnChainTxLinks transactions={row.transactions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableCaption className="pb-4">
                  Last updated {formatAsOf(summary.asOf)}
                </TableCaption>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
