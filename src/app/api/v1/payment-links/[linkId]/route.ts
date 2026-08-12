import { NextResponse } from "next/server";

import { resolveWorkspaceAgent } from "@/lib/db/agent-policies";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import {
  getPaymentLinkByUsernameAndPublicId,
  serializePaymentLinkListItem,
} from "@/lib/db/payment-links";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { PaymentLinkDoc } from "@/lib/db/types";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ linkId: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { linkId } = await params;
  const publicId = linkId.trim();
  if (!publicId) {
    return NextResponse.json({ error: "linkId is required" }, { status: 400 });
  }

  const db = await getDb();
  const link = await db.collection<PaymentLinkDoc>(COLLECTIONS.paymentLinks).findOne({
    workspaceId: context.workspace._id,
    publicId,
  });

  if (!link) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  const publicLink = await getPaymentLinkByUsernameAndPublicId(
    link.username,
    link.publicId,
  );

  if (!publicLink) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  return NextResponse.json({
    link: {
      ...serializePaymentLinkListItem(link),
      paidBy: publicLink.paidBy ?? null,
      paidTxHash: publicLink.paidTxHash ?? null,
      recipientAddress: publicLink.recipientAddress ?? null,
      canPay: publicLink.canPay,
    },
  });
}
