import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { verifyMessage } from "viem";

import {
  parseWalletVerifyFields,
  WALLET_VERIFY_MAX_AGE_MS,
} from "@/lib/auth-session";
import { getAgentWallets, getLinkedAgentById } from "@/lib/db/agents";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { AgentDoc } from "@/lib/db/merchant-types";
import { logSecurityEvent } from "@/lib/db/security-audit";
import { getPaySessionContext } from "@/lib/pay/session-api";
import { isSupportedWalletNetworkId } from "@/lib/wallet-networks";
import { isEvmAddress, normalizeWalletAddress } from "@/lib/db/wallets";
import {
  isValidSolanaAddress,
  verifySolanaSignature,
} from "@/lib/wallets/solana-verify";
import type { WalletNetworkId } from "@/lib/db/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  const agent = await getLinkedAgentById(ctx.workspaceId, new ObjectId(id));
  if (!agent) {
    return NextResponse.json({ error: "Linked agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    address?: string;
    networkId?: string;
    message?: string;
    signature?: string;
  };

  const address = body.address?.trim();
  const networkId = body.networkId?.trim();
  const message = body.message?.trim();
  const signature = body.signature?.trim();

  if (!address || !networkId || !message || !signature) {
    return NextResponse.json(
      { error: "address, networkId, message, and signature are required" },
      { status: 400 },
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

  if (Date.now() - parsedMessage.timestamp > WALLET_VERIFY_MAX_AGE_MS) {
    return NextResponse.json({ error: "Verification message expired" }, { status: 400 });
  }

  if (parsedMessage.networkId !== typedNetworkId) {
    return NextResponse.json({ error: "Invalid verification message" }, { status: 400 });
  }

  if (
    normalizeWalletAddress(parsedMessage.address, typedNetworkId) !== normalizedAddress
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

  const wallets = getAgentWallets(agent);
  const walletIndex = wallets.findIndex(
    (wallet) =>
      wallet.networkId === typedNetworkId &&
      normalizeWalletAddress(wallet.address, typedNetworkId) === normalizedAddress,
  );

  if (walletIndex === -1) {
    return NextResponse.json({ error: "Wallet not registered for this agent" }, { status: 400 });
  }

  const now = new Date();
  const verificationMethod = isSolana ? ("solana" as const) : ("eip191" as const);
  const nextWallets = wallets.map((wallet, index) =>
    index === walletIndex
      ? { ...wallet, verifiedAt: now, verificationMethod }
      : wallet,
  );

  const db = await getDb();
  await db.collection<AgentDoc>(COLLECTIONS.agents).updateOne(
    { _id: agent._id },
    { $set: { wallets: nextWallets, lastActiveAt: now, updatedAt: now } },
  );

  await logSecurityEvent({
    workspaceId: ctx.workspaceId,
    actorType: "user",
    actorId: ctx.userId.toString(),
    agentId: agent._id,
    action: "agent_wallet_verified",
    resourceType: "agent",
    resourceId: agent._id.toString(),
    security: ctx.security,
  });

  return NextResponse.json({
    ok: true,
    wallet: {
      networkId: typedNetworkId,
      address: normalizedAddress,
      verifiedAt: now.toISOString(),
      verificationMethod,
    },
  });
}
