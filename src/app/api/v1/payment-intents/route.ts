import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import {
  assertAgentIdMatchesContext,
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
  requireAgentScopedContext,
  requireApiPermission,
} from "@/lib/db/merchant-api";
import {
  createPaymentIntent,
  rejectActionablePaymentIntentsForAgent,
  serializePaymentIntent,
} from "@/lib/db/payment-intents";
import {
  evaluateAutoPayEligibility,
  tryAutoApprovePaymentIntent,
} from "@/lib/db/payment-intent-auto-approve";
import { withIdempotency } from "@/lib/merchant-api/idempotency";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";

export async function POST(request: Request) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const agentRequired = requireAgentScopedContext(context);
  if (agentRequired) return agentRequired;

  const permission = requireApiPermission(context, "payment_intents.create");
  if (permission) return permission;

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  return withIdempotency({
    workspaceId: context.workspace._id,
    request,
    route: "POST /api/v1/payment-intents",
    handler: async () => {
      const body = (await request.json()) as {
        agentId?: string;
        type?: "link" | "profile" | "address";
        linkUsername?: string;
        linkPublicId?: string;
        recipientUsername?: string;
        recipientAddress?: string;
        amount?: number;
        tokenId?: string;
        networkId?: string;
        savedAddressId?: string;
      };

      const agentMismatch = assertAgentIdMatchesContext(context, body.agentId);
      if (agentMismatch) return agentMismatch;

      if (!context.agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const type = body.type ?? "link";
      const autoExecute = await evaluateAutoPayEligibility({
        context,
        type,
        recipientAddress: body.recipientAddress,
        recipientUsername: body.recipientUsername,
        amount: body.amount,
        tokenId: body.tokenId,
        networkId: body.networkId,
      });

      if (autoExecute) {
        await rejectActionablePaymentIntentsForAgent({
          workspaceId: context.workspace._id,
          agentObjectId: context.agent._id,
        });
      }

      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      const result = await createPaymentIntent({
        workspaceId: context.workspace._id,
        agent: context.agent,
        type,
        linkUsername: body.linkUsername,
        linkPublicId: body.linkPublicId,
        recipientUsername: body.recipientUsername,
        recipientAddress: body.recipientAddress,
        amount: body.amount,
        tokenId: body.tokenId,
        networkId: body.networkId,
        savedAddressId:
          body.savedAddressId && ObjectId.isValid(body.savedAddressId)
            ? new ObjectId(body.savedAddressId)
            : undefined,
        idempotencyKey,
        autoExecute,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 404 });
      }

      const intent =
        result.created && !autoExecute
          ? await tryAutoApprovePaymentIntent({
              context,
              intent: result.intent,
            })
          : result.intent;

      return NextResponse.json({
        ok: true,
        created: result.created,
        autoApproved: intent.status === "approved" && intent.autoExecute === true,
        autoExecute: intent.autoExecute === true,
        intent: serializePaymentIntent(intent),
      });
    },
  });
}
