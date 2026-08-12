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
} from "@/lib/webhooks/dispatch";

type Params = { params: Promise<{ id: string }> };

async function getEndpoint(workspaceId: ObjectId, id: string) {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  return db.collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints).findOne({
    _id: new ObjectId(id),
    workspaceId,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const endpoint = await getEndpoint(context.workspace._id, id);
  if (!endpoint) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    enabled?: boolean;
    rotateSecret?: boolean;
  };

  if (body.enabled === undefined && !body.rotateSecret) {
    return NextResponse.json(
      { error: "Provide enabled and/or rotateSecret" },
      { status: 400 },
    );
  }

  const updates: Partial<Pick<WebhookEndpointDoc, "enabled" | "secret" | "updatedAt">> = {
    updatedAt: new Date(),
  };
  let newSecret: string | undefined;

  if (body.enabled !== undefined) {
    updates.enabled = Boolean(body.enabled);
  }
  if (body.rotateSecret) {
    newSecret = generateWebhookSecret();
    updates.secret = newSecret;
  }

  const db = await getDb();
  await db.collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints).updateOne(
    { _id: endpoint._id },
    { $set: updates },
  );

  return NextResponse.json({
    id: endpoint._id.toString(),
    enabled: updates.enabled ?? endpoint.enabled,
    updatedAt: updates.updatedAt!.toISOString(),
    ...(newSecret ? { secret: newSecret } : {}),
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const db = await getDb();
  const result = await db.collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints).deleteOne({
    _id: new ObjectId(id),
    workspaceId: context.workspace._id,
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
