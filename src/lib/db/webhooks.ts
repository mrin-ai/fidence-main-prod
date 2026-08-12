import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  generateWebhookSecret,
  type WebhookEndpointDoc,
  type WebhookEventType,
} from "@/lib/webhooks/dispatch";

export type WebhookEndpointSummary = {
  id: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  secretPrefix: string;
};

const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "payment_link.created",
  "payment_link.paid",
  "payment_link.expired",
  "profile_payment.received",
  "agent.payment_recorded",
  "compliance.approval_required",
  "compliance.approval.resolved",
];

function toSummary(doc: WebhookEndpointDoc): WebhookEndpointSummary {
  return {
    id: doc._id.toString(),
    url: doc.url,
    events: doc.events,
    enabled: doc.enabled,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    secretPrefix: `${doc.secret.slice(0, 12)}…`,
  };
}

export function isWebhookEventType(value: string): value is WebhookEventType {
  return WEBHOOK_EVENT_TYPES.includes(value as WebhookEventType);
}

export function listWebhookEventTypes() {
  return WEBHOOK_EVENT_TYPES;
}

export async function listWebhookEndpoints(workspaceId: ObjectId) {
  const db = await getDb();
  const docs = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

export async function createWebhookEndpoint(input: {
  workspaceId: ObjectId;
  url: string;
  events: WebhookEventType[];
  enabled?: boolean;
}) {
  const now = new Date();
  const secret = generateWebhookSecret();
  const doc: WebhookEndpointDoc = {
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    url: input.url,
    secret,
    events: input.events,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints).insertOne(doc);

  return {
    endpoint: toSummary(doc),
    secret,
  };
}

export async function updateWebhookEndpoint(input: {
  workspaceId: ObjectId;
  endpointId: ObjectId;
  url?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
}) {
  const updates: Partial<WebhookEndpointDoc> = {
    updatedAt: new Date(),
  };
  if (input.url !== undefined) updates.url = input.url;
  if (input.events !== undefined) updates.events = input.events;
  if (input.enabled !== undefined) updates.enabled = input.enabled;

  const db = await getDb();
  const result = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .findOneAndUpdate(
      { _id: input.endpointId, workspaceId: input.workspaceId },
      { $set: updates },
      { returnDocument: "after" },
    );

  return result ? toSummary(result) : null;
}

export async function deleteWebhookEndpoint(
  workspaceId: ObjectId,
  endpointId: ObjectId,
) {
  const db = await getDb();
  const result = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .deleteOne({ _id: endpointId, workspaceId });
  return result.deletedCount === 1;
}

export async function rotateWebhookSecret(
  workspaceId: ObjectId,
  endpointId: ObjectId,
) {
  const secret = generateWebhookSecret();
  const db = await getDb();
  const result = await db
    .collection<WebhookEndpointDoc>(COLLECTIONS.webhookEndpoints)
    .findOneAndUpdate(
      { _id: endpointId, workspaceId },
      { $set: { secret, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

  if (!result) return null;
  return {
    endpoint: toSummary(result),
    secret,
  };
}
