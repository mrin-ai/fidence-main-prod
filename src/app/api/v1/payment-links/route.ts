import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import {
  evaluateAndRecordPolicy,
  policyDeniedResponse,
} from "@/lib/compliance/evaluate-and-record";
import { toPolicyAmountUsd } from "@/lib/compliance/valuation";
import { requireActiveAgent } from "@/lib/db/agents";
import {
  decrementAgentLinkExposureHold,
  incrementAgentLinkExposureHold,
} from "@/lib/db/agent-spend";
import { createPaymentLink } from "@/lib/db/payment-links";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { requireRecipientAddress } from "@/lib/db/wallets";
import { logSecurityEvent } from "@/lib/db/security-audit";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import {
  listPaymentLinksPaginated,
} from "@/lib/db/payment-links";
import type { PaymentLinkStatus } from "@/lib/db/types";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const agentKey = url.searchParams.get("agentId")?.trim();
  const status = url.searchParams.get("status")?.trim() as
    | PaymentLinkStatus
    | "all"
    | undefined;
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 20);

  let agentPublicId: string | undefined;
  if (agentKey) {
    const agent = await resolveWorkspaceAgent(context.workspace._id, agentKey);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    agentPublicId = agent.publicId;
  }

  const result = await listPaymentLinksPaginated(context.workspace._id, {
    page,
    limit,
    status: status ?? "all",
    source: agentKey ? "agent" : undefined,
  });

  const links = agentPublicId
    ? result.items.filter((item) => item.agentPublicId === agentPublicId)
    : result.items;

  return NextResponse.json({
    links,
    page: result.page,
    limit: result.limit,
    total: agentPublicId ? links.length : result.total,
    totalPages: agentPublicId
      ? Math.max(1, Math.ceil(links.length / result.limit))
      : result.totalPages,
  });
}

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    agentId?: string;
    amount?: number | string;
    tokenId?: string;
    networkId?: string;
    expiresAt?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const amount = Number(body.amount);
  const tokenId = body.tokenId?.trim();
  const networkId = body.networkId?.trim();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!externalAgentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!amount || amount <= 0 || !tokenId || !networkId || !expiresAt) {
    return NextResponse.json(
      { error: "amount, tokenId, networkId, and expiresAt are required" },
      { status: 400 },
    );
  }

  if (!supportsOnChainPayment(networkId, tokenId)) {
    return NextResponse.json(
      {
        error: "This token/network combination is not supported",
        code: "TOKEN_NETWORK_UNSUPPORTED",
      },
      { status: 400 },
    );
  }

  const agentResult = await requireActiveAgent(
    context.workspace._id,
    externalAgentId,
  );

  if (!agentResult.ok) {
    return NextResponse.json(
      {
        error: agentResult.error,
        code: agentResult.code,
        hint: "Register the agent first via POST /api/v1/agents/register",
      },
      { status: agentResult.code === "AGENT_INACTIVE" ? 403 : 404 },
    );
  }

  const exposureUsd = toPolicyAmountUsd(amount, tokenId);
  if (!exposureUsd.ok) {
    return NextResponse.json(
      { error: "Amount valuation unavailable for policy", code: exposureUsd.code },
      { status: 400 },
    );
  }

  const hold = await incrementAgentLinkExposureHold({
    workspaceId: context.workspace._id,
    agentId: agentResult.agent._id,
    amountUsd: exposureUsd.amountUsd,
  });
  if (!hold.ok) {
    return NextResponse.json(
      { error: "Could not reserve link exposure", code: hold.code },
      { status: 400 },
    );
  }

  const policyResult = await evaluateAndRecordPolicy({
    workspaceId: context.workspace._id,
    agent: agentResult.agent,
    action: "payment_links.create",
    amount,
    tokenId,
    networkId,
    actor: actorFromSecurity(context.security, {
      actorType: "agent",
      agentId: agentResult.agent._id.toString(),
      agentPublicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    }),
    security: context.security,
    contentGuardArgs: body,
  });

  if (policyResult.verdict !== "allow") {
    await decrementAgentLinkExposureHold({
      workspaceId: context.workspace._id,
      agentId: agentResult.agent._id,
      amountUsd: exposureUsd.amountUsd,
    });
    return policyDeniedResponse(policyResult);
  }

  const recipient = requireRecipientAddress(context.owner, networkId);
  if (!recipient.ok) {
    await decrementAgentLinkExposureHold({
      workspaceId: context.workspace._id,
      agentId: agentResult.agent._id,
      amountUsd: exposureUsd.amountUsd,
    });
    return NextResponse.json(
      { error: recipient.error, code: recipient.code },
      { status: 400 },
    );
  }

  const link = await createPaymentLink({
    workspaceId: context.workspace._id,
    userId: context.owner._id,
    username: context.owner.username!,
    recipientAddress: recipient.recipientAddress,
    amount,
    tokenId,
    networkId,
    expiresAt,
    source: "agent",
    agentId: agentResult.agent._id,
    agentPublicId: agentResult.agent.publicId,
  });

  await decrementAgentLinkExposureHold({
    workspaceId: context.workspace._id,
    agentId: agentResult.agent._id,
    amountUsd: exposureUsd.amountUsd,
  });

  await logSecurityEvent({
    workspaceId: context.workspace._id,
    actorType: "api_key",
    actorId: context.owner._id.toString(),
    agentId: agentResult.agent._id,
    action: "agent_payment_link_created",
    resourceType: "payment_link",
    resourceId: link.id,
    security: context.security,
  });

  return NextResponse.json({
    ...link,
    receiptId: policyResult.receiptId,
    agent: {
      publicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    },
  });
}
