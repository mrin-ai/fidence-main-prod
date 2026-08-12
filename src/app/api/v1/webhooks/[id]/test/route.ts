import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import {
  signWebhookPayload,
  type WebhookEndpointDoc,
} from "@/lib/webhooks/dispatch";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const db = await getDb();
  const endpoint = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .findOne({
      _id: new ObjectId(id),
      workspaceId: context.workspace._id,
    });

  if (!endpoint) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const event = "payment_link.created";
  const payload = {
    id: "evt_test",
    event,
    createdAt: new Date().toISOString(),
    data: {
      test: true,
      workspaceId: context.workspace._id.toString(),
    },
  };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(endpoint.secret, timestamp, body);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fidence-Signature": signature,
        "X-Fidence-Event": event,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      event,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Delivery failed",
      },
      { status: 502 },
    );
  }
}
