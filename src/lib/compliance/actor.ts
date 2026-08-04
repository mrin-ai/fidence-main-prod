import type { SecurityContext } from "@/lib/db/merchant-types";
import { extractSecurityContext } from "@/lib/request-security";

export type ComplianceActorType = "user" | "agent" | "api_key" | "system";
export type ComplianceAuthMethod = "session" | "api_key" | "cli" | "system";

export type ComplianceActor = {
  actorType: ComplianceActorType;
  authMethod?: ComplianceAuthMethod;
  userId?: string;
  agentId?: string;
  agentPublicId?: string;
  externalAgentId?: string;
  ip: string;
  userAgent?: string;
  country?: string;
  device?: string;
  browser?: string;
};

export function actorFromSecurity(
  security: SecurityContext,
  fields: Omit<ComplianceActor, "ip" | "userAgent" | "country" | "device" | "browser">,
): ComplianceActor {
  return {
    ...fields,
    ip: security.ip || "unknown",
    userAgent: security.userAgent,
    country: security.country,
    device: security.device,
    browser: security.browser,
  };
}

export function buildComplianceActorFromRequest(
  request: Request,
  fields: Omit<ComplianceActor, "ip" | "userAgent" | "country" | "device" | "browser">,
): ComplianceActor {
  return actorFromSecurity(extractSecurityContext(request), fields);
}

export function systemComplianceActor(): ComplianceActor {
  return {
    actorType: "system",
    authMethod: "system",
    ip: "system",
  };
}
