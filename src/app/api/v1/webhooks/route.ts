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
  generateWebhookSecret,
  type WebhookEndpointDoc,
  type WebhookEventType,
} from "@/lib/webhooks/dispatch";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

const VALID_EVENTS: WebhookEventType[] = [
  "payment_link.created",
  "payment_link.paid",
  "payment_link.expired",
  "profile_payment.received",
  "agent.payment_recorded",
  "compliance.approval_required",
  "compliance.approval.resolved",
];

function serializeWebhookEndpoint(doc: WebhookEndpointDoc, includeSecret = false) {
  return {
    id: doc._id.toString(),
    url: doc.url,
    events: doc.events,
    enabled: doc.enabled,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    ...(includeSecret ? { secret: doc.secret } : {}),
  };
}

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const db = await getDb();
  const endpoints = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .find({ workspaceId: context.workspace._id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({
    webhooks: endpoints.map((endpoint) => serializeWebhookEndpoint(endpoint)),
  });
}

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = (await request.json()) as {
    url?: string;
    events?: string[];
    enabled?: boolean;
  };

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const urlCheck = validateWebhookUrl(url);
  if (!urlCheck.ok) {
    return NextResponse.json(
      { error: urlCheck.error, code: urlCheck.code },
      { status: 400 },
    );
  }

  const events = (body.events ?? []).filter((event): event is WebhookEventType =>
    VALID_EVENTS.includes(event as WebhookEventType),
  );

  if (events.length === 0) {
    return NextResponse.json(
      { error: "At least one valid event is required", validEvents: VALID_EVENTS },
      { status: 400 },
    );
  }

  const now = new Date();
  const doc: WebhookEndpointDoc = {
    _id: new ObjectId(),
    workspaceId: context.workspace._id,
    url: urlCheck.url,
    secret: generateWebhookSecret(),
    events,
    enabled: body.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints).insertOne(doc);

  return NextResponse.json(serializeWebhookEndpoint(doc, true), { status: 201 });
}
