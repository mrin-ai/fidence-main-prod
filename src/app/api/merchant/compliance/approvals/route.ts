import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { listPaymentApprovals } from "@/lib/db/payment-approvals";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const approvals = await listPaymentApprovals(session.workspace._id, status);

  return NextResponse.json({
    approvals: approvals.map((approval) => ({
      approvalId: approval.approvalId,
      status: approval.status,
      amountUsd: approval.amountUsd,
      networkId: approval.networkId,
      tokenId: approval.tokenId,
      externalAgentId: approval.externalAgentId,
      agentPublicId: approval.agentPublicId,
      payload: approval.payload,
      requestedBy: {
        actorType: approval.requestedBy.actorType,
        ip: approval.requestedBy.ip,
        externalAgentId: approval.requestedBy.externalAgentId ?? null,
      },
      resolvedBy: approval.resolvedBy
        ? {
            actorType: approval.resolvedBy.actorType,
            ip: approval.resolvedBy.ip,
            userId: approval.resolvedBy.userId ?? null,
          }
        : null,
      createdAt: approval.createdAt.toISOString(),
      expiresAt: approval.expiresAt.toISOString(),
      resolvedAt: approval.resolvedAt?.toISOString() ?? null,
    })),
  });
}
