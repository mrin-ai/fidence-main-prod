import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import type { PolicyCode } from "@/lib/compliance/codes";
import {
  evaluateAndRecordPolicy,
  policyDeniedResponse,
} from "@/lib/compliance/evaluate-and-record";
import { toPolicyAmountUsd } from "@/lib/compliance/valuation";
import { requireActiveAgent } from "@/lib/db/agents";
import {
  decrementAgentLinkExposureHold,
  getAgentOutstandingLinkExposureUsd,
  incrementAgentLinkExposureHold,
} from "@/lib/db/agent-spend";
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

  const actor = actorFromSecurity(context.security, {
    actorType: "agent",
    agentId: agentResult.agent._id.toString(),
    agentPublicId: agentResult.agent.publicId,
    externalAgentId: agentResult.agent.externalAgentId,
  });

  const parsedLinks: Array<{
    amount: number;
    tokenId: string;
    networkId: string;
    expiresAt: Date;
    recipientAddress: string;
    exposureUsd: number;
  }> = [];

  const itemDenies: Array<{
    index: number;
    code: string;
    codes: PolicyCode[];
    receiptId: string | null;
    message: string;
  }> = [];

  let runningOutstandingUsd = await getAgentOutstandingLinkExposureUsd(
    context.workspace._id,
    agentResult.agent._id,
  );

  const workspaceId = context.workspace._id;
  const agentObjectId = agentResult.agent._id;

  async function releaseParsedHolds() {
    for (const item of parsedLinks) {
      await decrementAgentLinkExposureHold({
        workspaceId,
        agentId: agentObjectId,
        amountUsd: item.exposureUsd,
      });
    }
  }

  for (const [index, link] of rawLinks.entries()) {
    const amount = Number(link.amount);
    const tokenId = link.tokenId?.trim();
    const networkId = link.networkId?.trim();
    const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null;

    if (
      !amount ||
      amount <= 0 ||
      !Number.isFinite(amount) ||
      !tokenId ||
      !networkId ||
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: `links[${index}] requires valid amount, tokenId, networkId, and future expiresAt`,
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

    const itemUsd = toPolicyAmountUsd(amount, tokenId);
    if (!itemUsd.ok) {
      return NextResponse.json(
        {
          error: `links[${index}] amount valuation unavailable`,
          code: itemUsd.code,
        },
        { status: 400 },
      );
    }

    const hold = await incrementAgentLinkExposureHold({
      workspaceId: context.workspace._id,
      agentId: agentResult.agent._id,
      amountUsd: itemUsd.amountUsd,
    });
    if (!hold.ok) {
      await releaseParsedHolds();
      return NextResponse.json(
        { error: `links[${index}] could not reserve exposure`, code: hold.code },
        { status: 400 },
      );
    }

    runningOutstandingUsd = await getAgentOutstandingLinkExposureUsd(
      context.workspace._id,
      agentResult.agent._id,
    );

    const policyResult = await evaluateAndRecordPolicy({
      workspaceId: context.workspace._id,
      agent: agentResult.agent,
      action: "payment_links.batch_item",
      amount,
      tokenId,
      networkId,
      actor,
      security: context.security,
      contentGuardArgs: link,
      outstandingUsd: runningOutstandingUsd,
    });

    if (policyResult.verdict !== "allow") {
      await decrementAgentLinkExposureHold({
        workspaceId: context.workspace._id,
        agentId: agentResult.agent._id,
        amountUsd: itemUsd.amountUsd,
      });
      itemDenies.push({
        index,
        code: policyResult.codes[0] ?? "POLICY_DENIED",
        codes: policyResult.codes,
        receiptId: policyResult.receiptId,
        message: `links[${index}] denied by policy`,
      });
      continue;
    }

    parsedLinks.push({
      amount,
      tokenId,
      networkId,
      expiresAt,
      recipientAddress: recipient.recipientAddress,
      exposureUsd: itemUsd.amountUsd,
    });
  }

  if (itemDenies.length > 0) {
    await releaseParsedHolds();
    await logSecurityEvent({
      workspaceId: context.workspace._id,
      actorType: "agent",
      actorId: agentResult.agent.publicId,
      agentId: agentResult.agent._id,
      action: "agent_policy_denied",
      resourceType: "payment_link_batch",
      resourceId: String(itemDenies.length),
      security: context.security,
    });

    const denied = policyDeniedResponse(
      {
        verdict: "deny",
        codes: itemDenies[0].codes,
        policyVersion: null,
        policyId: null,
        receiptId: itemDenies[0].receiptId,
        amountUsd: null,
        bypassed: false,
      },
      403,
    );
    const payload = await denied.json();
    return NextResponse.json(
      { ...payload, items: itemDenies },
      { status: 403 },
    );
  }

  const created = await createPaymentLinksBatch({
    workspaceId: context.workspace._id,
    userId: context.owner._id,
    username: context.owner.username!,
    agentId: agentResult.agent._id,
    agentPublicId: agentResult.agent.publicId,
    links: parsedLinks.map(({ exposureUsd: _exposureUsd, ...link }) => link),
  });

  for (const item of parsedLinks) {
    await decrementAgentLinkExposureHold({
      workspaceId: context.workspace._id,
      agentId: agentResult.agent._id,
      amountUsd: item.exposureUsd,
    });
  }

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
