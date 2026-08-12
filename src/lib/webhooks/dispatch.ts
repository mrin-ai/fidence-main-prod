import { createHmac, randomBytes } from "crypto";
import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";

export type WebhookEventType =
  | "payment_link.created"
  | "payment_link.paid"
  | "payment_link.expired"
  | "profile_payment.received"
  | "agent.payment_recorded"
  | "compliance.approval_required"
  | "compliance.approval.resolved";

export type WebhookEndpointDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WebhookDeliveryDoc = {
  _id: ObjectId;
  endpointId: ObjectId;
  workspaceId: ObjectId;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed" | "dead";
  attempts: number;
  nextRetryAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function signWebhookPayload(secret: string, timestamp: number, body: string) {
  const signed = `${timestamp}.${body}`;
  const signature = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export async function enqueueWebhookEvent(input: {
  workspaceId: ObjectId;
  event: WebhookEventType;
  payload: Record<string, unknown>;
}) {
  const db = await getDb();
  const endpoints = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .find({ workspaceId: input.workspaceId, enabled: true, events: input.event })
    .toArray();

  if (endpoints.length === 0) return;

  const now = new Date();
  await db.collection<WebhookDeliveryDoc>(COLLECTIONS.webhookDeliveries).insertMany(
    endpoints.map((endpoint) => ({
      _id: new ObjectId(),
      endpointId: endpoint._id,
      workspaceId: input.workspaceId,
      event: input.event,
      payload: input.payload,
      status: "pending" as const,
      attempts: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function drainWebhookDeliveries(limit = 50) {
  const db = await getDb();
  const now = new Date();
  const pending = await db
    .collection<WebhookDeliveryDoc>(COLLECTIONS.webhookDeliveries)
    .find({ status: "pending", nextRetryAt: { $lte: now } })
    .limit(limit)
    .toArray();

  let delivered = 0;
  let failed = 0;

  for (const delivery of pending) {
    const endpoint = await db
      .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
      .findOne({ _id: delivery.endpointId, enabled: true });

    if (!endpoint) {
      await db.collection(COLLECTIONS.webhookDeliveries).updateOne(
        { _id: delivery._id },
        { $set: { status: "failed", lastError: "endpoint_missing", updatedAt: now } },
      );
      failed += 1;
      continue;
    }

    const body = JSON.stringify({
      id: delivery._id.toString(),
      event: delivery.event,
      createdAt: delivery.createdAt.toISOString(),
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(endpoint.secret, timestamp, body);

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fidence-Signature": signature,
          "X-Fidence-Event": delivery.event,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        await db.collection(COLLECTIONS.webhookDeliveries).updateOne(
          { _id: delivery._id },
          { $set: { status: "delivered", updatedAt: now } },
        );
        delivered += 1;
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const maxAttempts = 10;
      const backoffMs = Math.min(60_000 * attempts, 3_600_000);
      await db.collection(COLLECTIONS.webhookDeliveries).updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: attempts >= maxAttempts ? "dead" : "pending",
            attempts,
            nextRetryAt: new Date(Date.now() + backoffMs),
            lastError: error instanceof Error ? error.message : "delivery_failed",
            updatedAt: now,
          },
        },
      );
      failed += 1;
    }
  }

  return { processed: pending.length, delivered, failed };
}
