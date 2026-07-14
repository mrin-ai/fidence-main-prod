import { NextResponse } from "next/server";

import { addAgentWallet } from "@/lib/db/agents";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    agentId?: string;
    walletAddress?: string;
    networkId?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const walletAddress = body.walletAddress?.trim();
  const networkId = body.networkId?.trim();

  if (!externalAgentId || !walletAddress || !networkId) {
    return NextResponse.json(
      { error: "agentId, walletAddress, and networkId are required" },
      { status: 400 },
    );
  }

  const result = await addAgentWallet({
    workspaceId: context.workspace._id,
    externalAgentId,
    walletAddress,
    networkId,
    security: context.security,
  });

  if (!result.ok) {
    const status =
      "code" in result && result.code === "AGENT_INACTIVE"
        ? 403
        : "code" in result && result.code === "AGENT_NOT_FOUND"
          ? 404
          : 400;

    return NextResponse.json(
      { error: result.error, ...("code" in result ? { code: result.code } : {}) },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    agent: {
      publicId: result.agent.publicId,
      externalAgentId: result.agent.externalAgentId,
      walletAddress: result.agent.walletAddress,
      networkId: result.agent.networkId,
      wallets: result.agent.wallets?.map((wallet) => ({
        id: wallet.id,
        networkId: wallet.networkId,
        address: wallet.address,
        addedAt: wallet.addedAt.toISOString(),
      })),
      created: result.created,
    },
  });
}
