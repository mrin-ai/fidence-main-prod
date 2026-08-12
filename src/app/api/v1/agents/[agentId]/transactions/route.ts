import { NextResponse } from "next/server";

import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import type { TransactionDoc } from "@/lib/db/types";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { agentId } = await params;
  const agent = await resolveWorkspaceAgent(context.workspace._id, agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const db = await getDb();
  const filter = {
    workspaceId: context.workspace._id,
    agentId: agent._id,
    status: "confirmed" as const,
  };

  const [transactions, total] = await Promise.all([
    db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.transactions).countDocuments(filter),
  ]);

  return NextResponse.json({
    agent: {
      publicId: agent.publicId,
      externalAgentId: agent.externalAgentId,
    },
    transactions: transactions.map((tx) => ({
      id: tx._id.toString(),
      label: tx.label,
      type: tx.type,
      amount: tx.amount,
      symbol: tx.symbol,
      networkId: tx.networkId ?? null,
      txHash: tx.txHash ?? null,
      payerAddress: tx.payerAddress ?? null,
      status: tx.status,
      occurredAt: tx.occurredAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
