import type { ObjectId } from "mongodb";

import { logSecurityEvent } from "@/lib/db/security-audit";
import type { SecurityActorType, SecurityContext } from "@/lib/db/merchant-types";

export async function logWorkspaceSecurityEvent(input: {
  workspaceId: ObjectId;
  actorType: SecurityActorType;
  actorId?: string;
  agentId?: ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: string;
  security: SecurityContext;
}) {
  await logSecurityEvent(input);
}
