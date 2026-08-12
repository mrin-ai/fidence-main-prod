import { createHash } from "crypto";
import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyDoc = {
  _id?: ObjectId;
  workspaceId: ObjectId;
  key: string;
  route: string;
  requestHash: string;
  status: "processing" | "completed";
  responseStatus: number;
  responseBody: string;
  createdAt: Date;
  expiresAt: Date;
};

function hashRequest(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

export async function beginIdempotency(input: {
  workspaceId: ObjectId;
  key: string;
  route: string;
  body: unknown;
}): Promise<
  | { kind: "replay"; status: number; body: string }
  | { kind: "conflict" }
  | { kind: "proceed" }
> {
  const db = await getDb();
  const now = new Date();
  const requestHash = hashRequest(input.body);
  const existing = await db.collection<IdempotencyDoc>(COLLECTIONS.idempotencyKeys).findOne({
    workspaceId: input.workspaceId,
    key: input.key,
    route: input.route,
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return { kind: "conflict" };
    }
    if (existing.status === "completed") {
      return {
        kind: "replay",
        status: existing.responseStatus,
        body: existing.responseBody,
      };
    }
    return { kind: "replay", status: 409, body: JSON.stringify({ error: "Request in progress" }) };
  }

  try {
    await db.collection<IdempotencyDoc>(COLLECTIONS.idempotencyKeys).insertOne({
      workspaceId: input.workspaceId,
      key: input.key,
      route: input.route,
      requestHash,
      status: "processing",
      responseStatus: 0,
      responseBody: "",
      createdAt: now,
      expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
    });
  } catch (error) {
    const isDuplicate =
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000;
    if (isDuplicate) {
      const doc = await db.collection<IdempotencyDoc>(COLLECTIONS.idempotencyKeys).findOne({
        workspaceId: input.workspaceId,
        key: input.key,
        route: input.route,
      });
      if (doc?.requestHash !== requestHash) return { kind: "conflict" };
      if (doc?.status === "completed") {
        return {
          kind: "replay",
          status: doc.responseStatus,
          body: doc.responseBody,
        };
      }
    }
    throw error;
  }

  return { kind: "proceed" };
}

export async function completeIdempotency(input: {
  workspaceId: ObjectId;
  key: string;
  route: string;
  response: Response;
}) {
  const db = await getDb();
  const body = await input.response.clone().text();
  await db.collection<IdempotencyDoc>(COLLECTIONS.idempotencyKeys).updateOne(
    {
      workspaceId: input.workspaceId,
      key: input.key,
      route: input.route,
    },
    {
      $set: {
        status: "completed",
        responseStatus: input.response.status,
        responseBody: body,
      },
    },
  );
}

export async function withIdempotency(input: {
  workspaceId: ObjectId;
  request: Request;
  route: string;
  required?: boolean;
  handler: () => Promise<Response>;
}) {
  const key = input.request.headers.get("idempotency-key")?.trim();
  if (!key) {
    if (input.required) {
      return Response.json(
        { ok: false, error: "Idempotency-Key header is required", code: "IDEMPOTENCY_KEY_REQUIRED" },
        { status: 400 },
      );
    }
    return input.handler();
  }

  let body: unknown = null;
  try {
    body = await input.request.clone().json();
  } catch {
    body = null;
  }

  const started = await beginIdempotency({
    workspaceId: input.workspaceId,
    key,
    route: input.route,
    body,
  });

  if (started.kind === "replay") {
    return new Response(started.body, {
      status: started.status,
      headers: { "Content-Type": "application/json", "X-Idempotency-Replay": "true" },
    });
  }

  if (started.kind === "conflict") {
    return Response.json(
      { ok: false, error: "Idempotency key reused with different body", code: "IDEMPOTENCY_CONFLICT" },
      { status: 409 },
    );
  }

  const response = await input.handler();
  await completeIdempotency({
    workspaceId: input.workspaceId,
    key,
    route: input.route,
    response,
  });
  return response;
}
