import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { createPaymentLink, listPaymentLinksForWorkspace } from "@/lib/db/payment-links";
import { requireRecipientAddress } from "@/lib/db/wallets";
import {
  matchesPaymentLinkFilter,
  type PaymentLinkFilterStatus,
  type PaymentLinkSort,
} from "@/lib/payment-link-status";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "all") as PaymentLinkFilterStatus;
  const sort = (searchParams.get("sort") ?? "newest") as PaymentLinkSort;
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  let links = await listPaymentLinksForWorkspace(session.workspace._id);

  if (status !== "all") {
    links = links.filter((link) => matchesPaymentLinkFilter(link.status, status));
  }

  if (query) {
    links = links.filter((link) => {
      const haystack = [
        link.publicId,
        link.url,
        link.amountLabel,
        link.tokenSymbol,
        link.networkLabel,
        link.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  links.sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

  return NextResponse.json({ links });
}

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

  const recipient = requireRecipientAddress(session.user, networkId);
  if (!recipient.ok) {
    return NextResponse.json(
      { error: recipient.error, code: recipient.code },
      { status: 400 },
    );
  }

  const link = await createPaymentLink({
    workspaceId: session.workspace._id,
    userId: session.user._id,
    username: session.user.username,
    recipientAddress: recipient.recipientAddress,
    amount,
    tokenId,
    networkId,
    expiresAt,
  });

  return NextResponse.json(link);
}
