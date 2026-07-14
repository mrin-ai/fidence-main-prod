import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { enqueueSecurityAudit } from "@/lib/db/security-audit-queue";
import type {
  SecurityActorType,
  SecurityAuditDoc,
  SecurityContext,
} from "@/lib/db/merchant-types";

export async function logSecurityEvent(input: {
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
}) {
  try {
    await enqueueSecurityAudit(input);
  } catch (error) {
    console.error("Security audit enqueue failed:", error);
  }
}

export async function logSecurityEventSync(input: {
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
}) {
  try {
    const db = await getDb();
    const now = input.security.timestamp;

    await db.collection<SecurityAuditDoc>(COLLECTIONS.securityAudit).insertOne({
      workspaceId: input.workspaceId,
      actorType: input.actorType,
      actorId: input.actorId,
      agentId: input.agentId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      security: input.security,
      occurredAt: now,
      date: input.security.date,
      createdAt: now,
    });
  } catch (error) {
    console.error("Security audit logging failed:", error);
  }
}
