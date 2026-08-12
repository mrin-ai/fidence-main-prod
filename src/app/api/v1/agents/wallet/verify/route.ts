import { NextResponse } from "next/server";
import { verifyMessage } from "viem";

import {
  parseWalletVerifyFields,
  WALLET_VERIFY_MAX_AGE_MS,
} from "@/lib/auth-session";
import {
  getAgentWallets,
  requireActiveAgent,
} from "@/lib/db/agents";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentDoc } from "@/lib/db/merchant-types";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { logSecurityEvent } from "@/lib/db/security-audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isSupportedWalletNetworkId } from "@/lib/wallet-networks";
import {
  isEvmAddress,
  normalizeWalletAddress,
} from "@/lib/db/wallets";
import {
  isValidSolanaAddress,
  verifySolanaSignature,
} from "@/lib/wallets/solana-verify";
import type { WalletNetworkId } from "@/lib/db/types";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    agentId?: string;
    address?: string;
    networkId?: string;
    message?: string;
    signature?: string;
  };

  const externalAgentId = body.agentId?.trim();
  const address = body.address?.trim();
  const networkId = body.networkId?.trim();
  const message = body.message?.trim();
  const signature = body.signature?.trim();

  if (!externalAgentId || !address || !networkId || !message || !signature) {
    return NextResponse.json(
      { error: "agentId, address, networkId, message, and signature are required" },
      { status: 400 },
    );
  }

  const agentLimit = await checkRateLimit(
    `agent:wallet-verify:${context.workspace._id.toString()}:${externalAgentId}`,
    { max: 30, windowMs: 60 * 60 * 1000 },
  );
  if (!agentLimit.allowed) {
    return rateLimitResponse(agentLimit);
  }

  const active = await requireActiveAgent(context.workspace._id, externalAgentId);
  if (!active.ok) {
    const status = active.code === "AGENT_INACTIVE" ? 403 : 404;
    return NextResponse.json(
      { error: active.error, code: active.code },
      { status },
    );
  }

  if (!isSupportedWalletNetworkId(networkId)) {
    return NextResponse.json({ error: "Unsupported network" }, { status: 400 });
  }

  const typedNetworkId = networkId as WalletNetworkId;
  const isSolana = typedNetworkId === "solana";
  const normalizedAddress = normalizeWalletAddress(address, typedNetworkId);

  if (isSolana) {
    if (!isValidSolanaAddress(normalizedAddress)) {
      return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
    }
  } else if (!isEvmAddress(normalizedAddress)) {
    return NextResponse.json({ error: "Invalid EVM address" }, { status: 400 });
  }

  const parsedMessage = parseWalletVerifyFields(message);
  if (parsedMessage == null) {
    return NextResponse.json({ error: "Invalid verification message" }, { status: 400 });
  }

  const {
    networkId: messageNetworkId,
    address: messageAddress,
    timestamp: messageTimestamp,
  } = parsedMessage;

  if (Date.now() - messageTimestamp > WALLET_VERIFY_MAX_AGE_MS) {
    return NextResponse.json(
      { error: "Verification message expired. Please sign again." },
      { status: 400 },
    );
  }

  if (messageNetworkId !== typedNetworkId) {
    return NextResponse.json({ error: "Invalid verification message" }, { status: 400 });
  }

  if (
    normalizeWalletAddress(messageAddress, typedNetworkId) !== normalizedAddress
  ) {
    return NextResponse.json({ error: "Invalid verification message" }, { status: 400 });
  }

  if (isSolana) {
    const solanaResult = verifySolanaSignature({
      address: normalizedAddress,
      message,
      signature,
    });

    if (!solanaResult.ok) {
      return NextResponse.json({ error: solanaResult.error }, { status: 401 });
    }
  } else {
    const valid = await verifyMessage({
      address: normalizedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const wallets = getAgentWallets(active.agent);
  const walletIndex = wallets.findIndex(
    (wallet) =>
      wallet.networkId === typedNetworkId &&
      normalizeWalletAddress(wallet.address, typedNetworkId) === normalizedAddress,
  );

  if (walletIndex === -1) {
    return NextResponse.json(
      {
        error: "Wallet not registered for this agent. Add it via POST /api/v1/agents/wallet first.",
        code: "AGENT_WALLET_NOT_REGISTERED",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const verificationMethod = isSolana ? "solana" as const : "eip191" as const;
  const nextWallets = wallets.map((wallet, index) =>
    index === walletIndex
      ? { ...wallet, verifiedAt: now, verificationMethod }
      : wallet,
  );

  const db = await getDb();
  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: active.agent._id },
    {
      $set: {
        wallets: nextWallets,
        lastActiveAt: now,
        updatedAt: now,
      },
    },
  );

  await logSecurityEvent({
    workspaceId: context.workspace._id,
    actorType: "agent",
    actorId: active.agent.publicId,
    agentId: active.agent._id,
    action: "agent_wallet_verified",
    resourceType: "agent",
    resourceId: active.agent._id.toString(),
    security: context.security,
  });

  return NextResponse.json({
    ok: true,
    agent: {
      publicId: active.agent.publicId,
      externalAgentId: active.agent.externalAgentId,
      wallet: {
        networkId: typedNetworkId,
        address: normalizedAddress,
        verifiedAt: now.toISOString(),
        verificationMethod,
      },
    },
  });
}
