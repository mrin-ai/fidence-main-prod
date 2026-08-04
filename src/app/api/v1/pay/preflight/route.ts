import { NextResponse } from "next/server";

import {
  preflightAgentLinkPayment,
  preflightAgentProfilePayment,
} from "@/lib/db/agent-pay-preflight";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.trim();
  const agentId = searchParams.get("agentId")?.trim();
  const payerAddress = searchParams.get("payerAddress")?.trim();

  if (!type || !agentId) {
    return NextResponse.json(
      { error: "type and agentId query params are required" },
      { status: 400 },
    );
  }

  if (type === "link") {
    const linkUsername = searchParams.get("linkUsername")?.trim();
    const linkId = searchParams.get("linkId")?.trim();

    if (!linkUsername || !linkId) {
      return NextResponse.json(
        { error: "linkUsername and linkId are required for type=link" },
        { status: 400 },
      );
    }

    const result = await preflightAgentLinkPayment({
      context,
      externalAgentId: agentId,
      linkUsername,
      linkPublicId: linkId,
      payerAddress,
    });

    return NextResponse.json(result);
  }

  if (type === "profile") {
    const recipientUsername = searchParams.get("recipientUsername")?.trim();
    const tokenId = searchParams.get("tokenId")?.trim();
    const networkId = searchParams.get("networkId")?.trim();

    if (!recipientUsername || !tokenId || !networkId) {
      return NextResponse.json(
        {
          error:
            "recipientUsername, tokenId, and networkId are required for type=profile",
        },
        { status: 400 },
      );
    }

    const amountRaw = searchParams.get("amount");
    const amount = amountRaw != null ? Number(amountRaw) : undefined;

    const result = await preflightAgentProfilePayment({
      context,
      externalAgentId: agentId,
      recipientUsername,
      tokenId,
      networkId,
      payerAddress,
      amount,
    });

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "type must be 'link' or 'profile'" },
    { status: 400 },
  );
}
