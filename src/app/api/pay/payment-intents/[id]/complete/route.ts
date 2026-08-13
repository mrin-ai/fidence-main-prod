import { NextResponse } from "next/server";

import { settleApprovedPaymentIntent } from "@/lib/db/payment-intent-settlement";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  const body = (await request.json()) as {
    payerAddress?: string;
    txHash?: string;
  };

  const payerAddress = body.payerAddress?.trim();
  const txHash = body.txHash?.trim();

  if (!payerAddress || !txHash) {
    return NextResponse.json(
      { error: "payerAddress and txHash are required" },
      { status: 400 },
    );
  }

  const result = await settleApprovedPaymentIntent({
    workspace: ctx.session.workspace,
    owner: ctx.session.user,
    intentId: id,
    payerAddress,
    txHash,
    security: ctx.security,
  });

  if (!result.ok) {
    if ("policyResponse" in result && result.policyResponse) {
      return result.policyResponse;
    }
    return NextResponse.json(
      { error: result.error, code: "code" in result ? result.code : undefined },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    intent: result.intent,
    transactionId: result.transactionId,
    txHash: result.txHash,
    duplicate: result.duplicate,
  });
}
