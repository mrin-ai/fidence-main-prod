import { ObjectId } from "mongodb";

import {
  cacheLlen,
  cacheLpop,
  cacheRpush,
} from "@/lib/cache/redis";
import { SECURITY_AUDIT_QUEUE_KEY } from "@/lib/cache/keys";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type {
  SecurityActorType,
  SecurityAuditDoc,
  SecurityContext,
} from "@/lib/db/merchant-types";

type QueuedSecurityAuditPayload = {
  workspaceId: string;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: {
    ip: string;
    userAgent: string;
    device: string;
    browser: string;
    country?: string;
    timestamp: string;
    date: string;
  };
};

function serializeAuditInput(input: {
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
}) {
  const payload: QueuedSecurityAuditPayload = {
    workspaceId: input.workspaceId.toString(),
    actorType: input.actorType,
    actorId: input.actorId,
    agentId: input.agentId?.toString(),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    security: {
      ip: input.security.ip,
      userAgent: input.security.userAgent,
      device: input.security.device,
      browser: input.security.browser,
      country: input.security.country,
      timestamp: input.security.timestamp.toISOString(),
      date: input.security.date,
    },
  };
  return JSON.stringify(payload);
}

function parseQueuedAudit(raw: unknown) {
  try {
    const payload = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as QueuedSecurityAuditPayload;
    if (!payload.workspaceId || !payload.action || !payload.security) {
      return null;
    }

    return {
      workspaceId: new ObjectId(payload.workspaceId),
      actorType: payload.actorType,
      actorId: payload.actorId,
      agentId: payload.agentId ? new ObjectId(payload.agentId) : undefined,
      action: payload.action,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      security: {
        ...payload.security,
        timestamp: new Date(payload.security.timestamp),
      } satisfies SecurityContext,
    };
  } catch {
    return null;
  }
}

export async function enqueueSecurityAudit(input: {
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
}) {
  await cacheRpush(SECURITY_AUDIT_QUEUE_KEY, serializeAuditInput(input));
}

export async function drainSecurityAuditQueue(batchSize = 100) {
  const queueLength = await cacheLlen(SECURITY_AUDIT_QUEUE_KEY);
  if (queueLength === 0) {
    return { drained: 0 };
  }

  const payloads = [];

  for (let index = 0; index < batchSize; index += 1) {
    const raw = await cacheLpop(SECURITY_AUDIT_QUEUE_KEY);
    if (!raw) break;
    const parsed = parseQueuedAudit(raw);
    if (parsed) payloads.push(parsed);
  }

  if (payloads.length === 0) {
    return { drained: 0 };
  }

  const db = await getDb();
  const now = new Date();

  const docs: SecurityAuditDoc[] = payloads.map((input) => ({
    workspaceId: input.workspaceId,
    actorType: input.actorType,
    actorId: input.actorId,
    agentId: input.agentId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    security: input.security,
    occurredAt: input.security.timestamp,
    date: input.security.date,
    createdAt: now,
  }));

  await db.collection<SecurityAuditDoc>(COLLECTIONS.securityAudit).insertMany(docs);

  return { drained: docs.length };
}
