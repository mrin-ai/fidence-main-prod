import { NextResponse } from "next/server";

import { requireActiveAgent } from "@/lib/db/agents";
import { createPaymentLinksBatch } from "@/lib/db/payment-links";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { requireRecipientAddress } from "@/lib/db/wallets";
import { logSecurityEvent } from "@/lib/db/security-audit";
import {
  enforceMerchantApiRateLimit,
  enforceMerchantBatchRateLimit,
  PAYMENT_LINK_BATCH_MAX,
} from "@/lib/merchant-api/rate-limit";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

type BatchLinkInput = {
  amount?: number | string;
  tokenId?: string;
  networkId?: string;
  expiresAt?: string;
};

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited =
    (await enforceMerchantApiRateLimit(getWorkspaceId(context))) ??
    (await enforceMerchantBatchRateLimit(getWorkspaceId(context)));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    agentId?: string;
    links?: BatchLinkInput[];
  };

  const externalAgentId = body.agentId?.trim();
  const rawLinks = body.links;

  if (!externalAgentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!Array.isArray(rawLinks) || rawLinks.length === 0) {
    return NextResponse.json(
      { error: "links must be a non-empty array" },
      { status: 400 },
    );
  }

  if (rawLinks.length > PAYMENT_LINK_BATCH_MAX) {
    return NextResponse.json(
      {
        error: `Maximum ${PAYMENT_LINK_BATCH_MAX} links per batch request`,
        code: "BATCH_TOO_LARGE",
        maxBatchSize: PAYMENT_LINK_BATCH_MAX,
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

  const parsedLinks: Array<{
    amount: number;
    tokenId: string;
    networkId: string;
    expiresAt: Date;
    recipientAddress: string;
  }> = [];

  for (const [index, link] of rawLinks.entries()) {
    const amount = Number(link.amount);
    const tokenId = link.tokenId?.trim();
    const networkId = link.networkId?.trim();
    const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null;

    if (!amount || amount <= 0 || !tokenId || !networkId || !expiresAt) {
      return NextResponse.json(
        {
          error: `links[${index}] requires amount, tokenId, networkId, and expiresAt`,
        },
        { status: 400 },
      );
    }

    if (!supportsOnChainPayment(networkId, tokenId)) {
      return NextResponse.json(
        {
          error: `links[${index}] token/network combination is not supported`,
          code: "TOKEN_NETWORK_UNSUPPORTED",
        },
        { status: 400 },
      );
    }

    const recipient = requireRecipientAddress(context.owner, networkId);
    if (!recipient.ok) {
      return NextResponse.json(
        {
          error: `links[${index}]: ${recipient.error}`,
          code: recipient.code,
        },
        { status: 400 },
      );
    }

    parsedLinks.push({
      amount,
      tokenId,
      networkId,
      expiresAt,
      recipientAddress: recipient.recipientAddress,
    });
  }

  const created = await createPaymentLinksBatch({
    workspaceId: context.workspace._id,
    userId: context.owner._id,
    username: context.owner.username!,
    agentId: agentResult.agent._id,
    agentPublicId: agentResult.agent.publicId,
    links: parsedLinks,
  });

  await logSecurityEvent({
    workspaceId: context.workspace._id,
    actorType: "api_key",
    actorId: context.owner._id.toString(),
    agentId: agentResult.agent._id,
    action: "agent_payment_links_batch_created",
    resourceType: "payment_link",
    resourceId: `${created.length}`,
    security: context.security,
  });

  return NextResponse.json({
    count: created.length,
    links: created,
    agent: {
      publicId: agentResult.agent.publicId,
      externalAgentId: agentResult.agent.externalAgentId,
    },
  });
}
