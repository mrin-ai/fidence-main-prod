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

const LEADERBOARD_COLUMN_WIDTHS = ["6%", "14%", "16%", "16%", "16%", "16%", "16%"] as const;

const TABLE_HEAD =
  "px-4 py-3.5 align-middle last:pr-6 font-medium text-muted-foreground";
const TABLE_CELL = "px-4 py-3.5 align-middle last:pr-6";
const TABLE_CELL_CENTER = cn(TABLE_CELL, "text-center");
const TABLE_HEAD_LEADING = "py-3.5 pl-4 pr-2 align-middle font-medium text-muted-foreground";
const TABLE_CELL_LEADING = "py-3.5 pl-4 pr-2 align-middle";

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

/** UI-only placeholders until trust/reputation backend ships. */
function placeholderTrustScore(publicId: string) {
  let hash = 0;
  for (let i = 0; i < publicId.length; i += 1) {
    hash = (hash + publicId.charCodeAt(i) * (i + 1)) % 100;
  }
  return 55 + (hash % 40);
}

function placeholderReputation(publicId: string) {
  const score = placeholderTrustScore(publicId);
  if (score >= 85) {
    return {
      label: "Excellent",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    };
  }
  if (score >= 72) {
    return {
      label: "Trusted",
      className: "border-sky-500/20 bg-sky-500/10 text-sky-700",
    };
  }
  if (score >= 60) {
    return {
      label: "Established",
      className: "border-violet-500/20 bg-violet-500/10 text-violet-700",
    };
  }
  return {
    label: "New",
    className: "border-slate-500/20 bg-slate-500/10 text-slate-600",
  };
}

function TrustScoreCell({ publicId }: { publicId: string }) {
  const score = placeholderTrustScore(publicId);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default items-center gap-1.5 tabular-nums">
            <span className="font-medium">{score}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </span>
        }
      />
      <TooltipContent>Placeholder score — backend coming soon</TooltipContent>
    </Tooltip>
  );
}

function ReputationBadge({ publicId }: { publicId: string }) {
  const reputation = placeholderReputation(publicId);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="outline" className={cn("capitalize", reputation.className)}>
            {reputation.label}
          </Badge>
        }
      />
      <TooltipContent>Placeholder reputation — backend coming soon</TooltipContent>
    </Tooltip>
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
              Ranked by trust score and on-chain activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No agents on the leaderboard yet.
              </p>
            ) : (
              <Table className="table-fixed w-full">
                <colgroup>
                  {LEADERBOARD_COLUMN_WIDTHS.map((width, index) => (
                    <col
                      key={`leaderboard-col-${index}`}
                      style={{ width }}
                    />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={TABLE_HEAD_LEADING}>Rank</TableHead>
                    <TableHead className={TABLE_HEAD_LEADING}>Agent ID</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "text-center")}>
                      Trust score
                    </TableHead>
                    <TableHead className={cn(TABLE_HEAD, "text-center")}>
                      Reputation
                    </TableHead>
                    <TableHead className={cn(TABLE_HEAD, "text-center")}>
                      Verified
                    </TableHead>
                    <TableHead className={cn(TABLE_HEAD, "text-center")}>Status</TableHead>
                    <TableHead className={TABLE_HEAD}>On-chain</TableHead>
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
                      <TableCell className={TABLE_CELL_LEADING}>
                        <RankBadge rank={row.rank} />
                      </TableCell>
                      <TableCell className={TABLE_CELL_LEADING}>
                        <Badge variant="outline" className="max-w-full truncate font-mono font-normal">
                          {row.publicId}
                        </Badge>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CENTER}>
                        <div className="flex justify-center">
                          <TrustScoreCell publicId={row.publicId} />
                        </div>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CENTER}>
                        <div className="flex justify-center">
                          <ReputationBadge publicId={row.publicId} />
                        </div>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CENTER}>
                        <div className="flex justify-center">
                          <VerificationBadge verified={row.verified} />
                        </div>
                      </TableCell>
                      <TableCell className={TABLE_CELL_CENTER}>
                        <div className="flex justify-center">
                          <Badge
                            variant={row.status === "active" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {row.status}
                          </Badge>
                        </div>
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
