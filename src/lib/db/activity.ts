import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ActivityEventDoc } from "@/lib/db/types";
import type { ActivityLogInput } from "@/lib/db/activity-types";

export async function logActivity(input: ActivityLogInput) {
  const db = await getDb();
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  const doc: Omit<ActivityEventDoc, "_id"> = {
    workspaceId: input.workspaceId,
    type: input.type,
    summary: input.summary,
    meta: "",
    status: input.status,
    occurredAt,
    createdAt: now,
  };

  const result = await db.collection(COLLECTIONS.activityEvents).insertOne(doc);
  return result.insertedId;
}

export async function logLoginActivity(
  workspaceId: ObjectId,
  method: "google" | "wallet",
) {
  const summary =
    method === "google" ? "Logged in via Google" : "Logged in via wallet";

  return logActivity({
    workspaceId,
    type: "login",
    summary,
  });
}

export async function logLogoutActivity(workspaceId: ObjectId) {
  return logActivity({
    workspaceId,
    type: "logout",
    summary: "Logged out",
  });
}

export async function logPaymentLinkCreatedActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "payment_link_created",
    summary: `Payment link created · ${input.amount} ${input.tokenSymbol}`,
  });
}

export async function logPaymentReceivedActivity(input: {
  workspaceId: ObjectId;
  amount: number;
  tokenSymbol: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "payment_received",
    summary: `Payment received · ${input.amount} ${input.tokenSymbol}`,
    status: "settled",
  });
}

export async function logInvoiceCreatedActivity(input: {
  workspaceId: ObjectId;
  reference: string;
}) {
  return logActivity({
    workspaceId: input.workspaceId,
    type: "invoice_created",
    summary: `Invoice created · ${input.reference}`,
  });
}
