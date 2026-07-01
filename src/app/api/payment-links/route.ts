import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { createPaymentLink } from "@/lib/db/payment-links";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.username) {
    return NextResponse.json(
      {
        error: "Set a username in Settings before creating payment links",
        code: "USERNAME_REQUIRED",
      },
      { status: 400 },
    );
  }

  const recipientAddress = session.user.walletAddresses[0];

  if (!recipientAddress) {
    return NextResponse.json(
      {
        error: "Connect a wallet to your account to receive payments",
        code: "WALLET_REQUIRED",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    amount?: number | string;
    tokenId?: string;
    networkId?: string;
    expiresAt?: string;
  };

  const amount = Number(body.amount);
  const tokenId = body.tokenId?.trim();
  const networkId = body.networkId?.trim();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!amount || amount <= 0 || !tokenId || !networkId || !expiresAt) {
    return NextResponse.json({ error: "Invalid payment link payload" }, { status: 400 });
  }

  const link = await createPaymentLink({
    workspaceId: session.workspace._id,
    userId: session.user._id,
    username: session.user.username,
    recipientAddress,
    amount,
    tokenId,
    networkId,
    expiresAt,
  });

  return NextResponse.json(link);
}
