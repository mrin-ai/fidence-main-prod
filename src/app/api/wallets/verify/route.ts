import { NextResponse } from "next/server";
import { verifyMessage } from "viem";

import {
  parseWalletVerifyFields,
  WALLET_VERIFY_MAX_AGE_MS,
} from "@/lib/auth-session";
import { getNetworkById } from "@/lib/create-payment-link-data";
import { logWalletVerifiedActivity } from "@/lib/db/activity";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  addVerifiedWallet,
  isEvmAddress,
  normalizeWalletAddress,
} from "@/lib/db/wallets";
import type { WalletNetworkId } from "@/lib/db/types";
import { isValidSolanaAddress } from "@/lib/wallets/solana-verify";

const WALLET_NETWORK_IDS = new Set([
  "base",
  "ethereum",
  "arbitrum",
  "polygon",
  "solana",
]);

export async function POST(request: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await checkRateLimit(
      `wallet:verify:${session.user._id.toString()}`,
      { max: 20, windowMs: 60 * 60 * 1000 },
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    if (!session.user.username) {
      return NextResponse.json(
        {
          error: "Set a username in Settings before adding wallets",
          code: "USERNAME_REQUIRED",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      address?: string;
      networkId?: string;
      label?: string;
      message?: string;
      signature?: string;
    };

    const { address, networkId, label, message, signature } = body;

    if (!address || !networkId || !message || !signature) {
      return NextResponse.json(
        { error: "Address, network, message, and signature are required" },
        { status: 400 },
      );
    }

    if (!WALLET_NETWORK_IDS.has(networkId)) {
      return NextResponse.json({ error: "Unsupported network" }, { status: 400 });
    }

    const typedNetworkId = networkId as WalletNetworkId;

    if (typedNetworkId === "solana") {
      return NextResponse.json(
        {
          error: "Solana wallet verification is coming soon",
          code: "SOLANA_NOT_SUPPORTED",
        },
        { status: 400 },
      );
    }

    const normalizedAddress = normalizeWalletAddress(address, typedNetworkId);

    if (!isEvmAddress(normalizedAddress)) {
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

    const valid = await verifyMessage({
      address: normalizedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const result = await addVerifiedWallet(session.user._id, {
      networkId: typedNetworkId,
      address: normalizedAddress,
      label,
      verificationMethod: "eip191",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    const network = getNetworkById(typedNetworkId);

    await logWalletVerifiedActivity({
      workspaceId: session.workspace._id,
      networkLabel: network?.label ?? typedNetworkId,
      address: normalizedAddress,
    });

    return NextResponse.json({
      wallet: {
        id: result.wallet.id,
        networkId: result.wallet.networkId,
        networkLabel: network?.label ?? typedNetworkId,
        address: result.wallet.address,
        label: result.wallet.label,
        verifiedAt: result.wallet.verifiedAt.toISOString(),
        verificationMethod: result.wallet.verificationMethod,
      },
    });
  } catch (error) {
    console.error("Wallet verification failed:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
