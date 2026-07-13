import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { createPaymentLink, listPaymentLinksPaginated } from "@/lib/db/payment-links";
import { requireRecipientAddress } from "@/lib/db/wallets";
import type { PaymentLinkFilterStatus, PaymentLinkSort } from "@/lib/payment-link-status";
import type { CommerceSource } from "@/lib/db/merchant-types";
import { extractSecurityContext } from "@/lib/request-security";
import { logSecurityEvent } from "@/lib/db/security-audit";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "all") as PaymentLinkFilterStatus;
  const sort = (searchParams.get("sort") ?? "newest") as PaymentLinkSort;
  const query = searchParams.get("q")?.trim() ?? "";
  const source = (searchParams.get("source") ?? "human") as CommerceSource;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");

  const result = await listPaymentLinksPaginated(session.workspace._id, {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 20,
    status,
    sort,
    query,
    source,
  });

  return NextResponse.json({
    links: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
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
    source: "human",
  });

  await logSecurityEvent({
    workspaceId: session.workspace._id,
    actorType: "user",
    actorId: session.user._id.toString(),
    action: "human_payment_link_created",
    resourceType: "payment_link",
    resourceId: link.id,
    security: extractSecurityContext(request),
  });

  return NextResponse.json(link);
}
