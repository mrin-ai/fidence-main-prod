import type { ObjectId } from "mongodb";

import {
  capLeaderboardLimit,
  sortLeaderboardEntries,
} from "@/lib/agent-leaderboard-rank";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentDoc } from "@/lib/db/merchant-types";
import type { PaymentLinkDoc } from "@/lib/db/types";

const DEFAULT_LIMIT = 50;
const MAX_TX_LINKS_PER_AGENT = 5;

const VERIFIED_AUDIT_ACTIONS = [
  "agent_payment_link_paid",
  "agent_profile_payment",
] as const;

const CONFIRMED_AGENT_TXN_MATCH = {
  agentId: { $exists: true },
  status: "confirmed" as const,
  txHash: { $exists: true, $nin: [null, ""] },
};

export type AgentLeaderboardSummary = {
  totalValue: number;
  totalTxns: number;
  activeAgents: number;
  asOf: string;
};

export type AgentLeaderboardTxn = {
  txHash: string;
  networkId: string;
  explorerUrl: string | null;
};

export type AgentLeaderboardRow = {
  rank: number;
  publicId: string;
  name: string;
  totalValue: number;
  amountReceived: number;
  amountPaid: number;
  txnCount: number;
  transactions: AgentLeaderboardTxn[];
  linksPaid: number;
  linksCreated: number;
  verified: boolean;
  status: AgentDoc["status"];
};

export type AgentLeaderboard = {
  summary: AgentLeaderboardSummary;
  rows: AgentLeaderboardRow[];
};

type AgentTxnStats = {
  _id: ObjectId;
  txnCount: number;
  totalVolume: number;
  amountReceived: number;
  amountPaid: number;
};

type AgentTxnList = {
  _id: ObjectId;
  transactions: Array<{ txHash: string; networkId: string }>;
};

function countMap(
  entries: Array<{ _id: ObjectId; count: number }>,
) {
  return new Map(entries.map((entry) => [entry._id.toString(), entry.count]));
}

function verifiedSet(entries: Array<{ _id: ObjectId }>) {
  return new Set(entries.map((entry) => entry._id.toString()));
}

function mapAgentTransactions(
  transactions: Array<{ txHash: string; networkId: string }>,
): AgentLeaderboardTxn[] {
  return transactions.map((transaction) => ({
    txHash: transaction.txHash,
    networkId: transaction.networkId,
    explorerUrl: transaction.networkId
      ? getTxExplorerUrl(transaction.networkId, transaction.txHash)
      : null,
  }));
}

function agentTxnStatsPipeline(agentIds?: ObjectId[]) {
  return [
    {
      $match: {
        ...CONFIRMED_AGENT_TXN_MATCH,
        ...(agentIds ? { agentId: { $in: agentIds } } : {}),
      },
    },
    {
      $group: {
        _id: { agentId: "$agentId", txHash: "$txHash" },
        amount: { $first: "$amount" },
        received: {
          $max: {
            $cond: [
              { $in: ["$type", ["payment_received", "profile_payment"]] },
              "$amount",
              0,
            ],
          },
        },
        paid: {
          $max: {
            $cond: [{ $eq: ["$type", "payment_sent"] }, "$amount", 0],
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.agentId",
        txnCount: { $sum: 1 },
        totalVolume: { $sum: "$amount" },
        amountReceived: { $sum: "$received" },
        amountPaid: { $sum: "$paid" },
      },
    },
  ];
}

function agentTxnListPipeline(agentIds: ObjectId[]) {
  return [
    {
      $match: {
        ...CONFIRMED_AGENT_TXN_MATCH,
        agentId: { $in: agentIds },
      },
    },
    { $sort: { occurredAt: -1 } },
    {
      $group: {
        _id: { agentId: "$agentId", txHash: "$txHash" },
        networkId: { $first: "$networkId" },
        occurredAt: { $first: "$occurredAt" },
      },
    },
    { $sort: { occurredAt: -1 } },
    {
      $group: {
        _id: "$_id.agentId",
        transactions: {
          $push: {
            txHash: "$_id.txHash",
            networkId: { $ifNull: ["$networkId", ""] },
          },
        },
      },
    },
    {
      $project: {
        transactions: { $slice: ["$transactions", MAX_TX_LINKS_PER_AGENT] },
      },
    },
  ];
}

export async function getAgentLeaderboard(
  limit = DEFAULT_LIMIT,
): Promise<AgentLeaderboard> {
  const db = await getDb();
  const cappedLimit = capLeaderboardLimit(limit);

  const agents = await db
    .collection<AgentDoc>(COLLECTIONS.agents)
    .find({})
    .toArray();

  const agentIds = agents.map((agent) => agent._id);

  const [
    txnStatsRows,
    txnListRows,
    linksPaidRows,
    verifiedRows,
    globalVolumeRows,
    globalTxnRows,
    activeAgents,
  ] = await Promise.all([
    agentIds.length
      ? db
          .collection(COLLECTIONS.transactions)
          .aggregate<AgentTxnStats>(agentTxnStatsPipeline(agentIds))
          .toArray()
      : Promise.resolve([]),
    agentIds.length
      ? db
          .collection(COLLECTIONS.transactions)
          .aggregate<AgentTxnList>(agentTxnListPipeline(agentIds))
          .toArray()
      : Promise.resolve([]),
    agentIds.length
      ? db
          .collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks)
          .aggregate<{ _id: ObjectId; count: number }>([
            {
              $match: {
                agentId: { $in: agentIds },
                status: "paid",
              },
            },
            { $group: { _id: "$agentId", count: { $sum: 1 } } },
          ])
          .toArray()
      : Promise.resolve([]),
    agentIds.length
      ? db
          .collection(COLLECTIONS.securityAudit)
          .aggregate<{ _id: ObjectId }>([
            {
              $match: {
                agentId: { $in: agentIds },
                action: { $in: [...VERIFIED_AUDIT_ACTIONS] },
              },
            },
            { $group: { _id: "$agentId" } },
          ])
          .toArray()
      : Promise.resolve([]),
    db
      .collection(COLLECTIONS.transactions)
      .aggregate<{ _id: null; totalValue: number }>([
        { $match: CONFIRMED_AGENT_TXN_MATCH },
        { $group: { _id: "$txHash", amount: { $first: "$amount" } } },
        { $group: { _id: null, totalValue: { $sum: "$amount" } } },
      ])
      .toArray(),
    db
      .collection(COLLECTIONS.transactions)
      .aggregate<{ totalTxns: number }>([
        { $match: CONFIRMED_AGENT_TXN_MATCH },
        { $group: { _id: { agentId: "$agentId", txHash: "$txHash" } } },
        { $count: "totalTxns" },
      ])
      .toArray(),
    db.collection<AgentDoc>(COLLECTIONS.agents).countDocuments({
      status: "active",
    }),
  ]);

  const txnStats = new Map(
    txnStatsRows.map((row) => [row._id.toString(), row]),
  );
  const txnLists = new Map(
    txnListRows.map((row) => [row._id.toString(), row.transactions]),
  );
  const linksPaidCounts = countMap(linksPaidRows);
  const verifiedAgents = verifiedSet(verifiedRows);

  const rankedAgents = sortLeaderboardEntries(
    agents.map((agent) => {
      const stats = txnStats.get(agent._id.toString());
      return {
        agent,
        totalValue: stats?.totalVolume ?? 0,
        amountReceived: stats?.amountReceived ?? 0,
        amountPaid: stats?.amountPaid ?? 0,
        txnCount: stats?.txnCount ?? 0,
        linksCreated: agent.linksCreated,
        transactions: mapAgentTransactions(
          txnLists.get(agent._id.toString()) ?? [],
        ),
      };
    }),
  ).slice(0, cappedLimit);

  const rows: AgentLeaderboardRow[] = rankedAgents.map((entry, index) => ({
    rank: index + 1,
    publicId: entry.agent.publicId,
    name: entry.agent.name ?? entry.agent.externalAgentId,
    totalValue: entry.totalValue,
    amountReceived: entry.amountReceived,
    amountPaid: entry.amountPaid,
    txnCount: entry.txnCount,
    transactions: entry.transactions,
    linksPaid: linksPaidCounts.get(entry.agent._id.toString()) ?? 0,
    linksCreated: entry.agent.linksCreated,
    verified: verifiedAgents.has(entry.agent._id.toString()),
    status: entry.agent.status,
  }));

  return {
    summary: {
      totalValue: globalVolumeRows[0]?.totalValue ?? 0,
      totalTxns: globalTxnRows[0]?.totalTxns ?? 0,
      activeAgents,
      asOf: new Date().toISOString(),
    },
    rows,
  };
}
