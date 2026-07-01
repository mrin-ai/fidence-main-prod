import { NextResponse } from "next/server";

import {
  getPaymentLinkByUsernameAndPublicId,
  markPaymentLinkPaid,
} from "@/lib/db/payment-links";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";

type RouteContext = {
  params: Promise<{ username: string; linkId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username, linkId } = await context.params;

  if (isReservedPaymentPathSegment(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await getPaymentLinkByUsernameAndPublicId(username, linkId);

  if (!link) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  return NextResponse.json(link);
}

export async function POST(request: Request, context: RouteContext) {
  const { username, linkId } = await context.params;

  if (isReservedPaymentPathSegment(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    payerAddress?: string;
    txHash?: string;
  };

  const payerAddress = body.payerAddress?.trim();
  const txHash = body.txHash?.trim();

  if (!payerAddress || !txHash) {
    return NextResponse.json(
      { error: "Wallet address and transaction hash are required" },
      { status: 400 },
    );
  }

  const result = await markPaymentLinkPaid({
    username,
    publicId: linkId,
    payerAddress,
    txHash,
  });

  if (!result.ok) {
    const status =
      result.error === "Payment link not found"
        ? 404
        : result.error === "This link has already been paid"
          ? 409
          : 400;

    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.link);
}
