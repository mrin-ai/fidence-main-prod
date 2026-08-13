import type { ObjectId } from "mongodb";

import {
  getCachedMerchantContext,
  setCachedMerchantContext,
} from "@/lib/cache/merchant-context-cache";
import { apiKeyHasPermission, extractBearerToken, hashApiKey, resolveApiKey } from "@/lib/db/api-keys";
import type { AgentDoc, ApiKeyDoc } from "@/lib/db/merchant-types";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { SecurityContext } from "@/lib/db/merchant-types";
import type { UserDoc, WorkspaceDoc } from "@/lib/db/types";
import { extractSecurityContext } from "@/lib/request-security";

export type MerchantApiContext = {
  workspace: WorkspaceDoc;
  owner: UserDoc;
  security: SecurityContext;
  apiKey: ApiKeyDoc;
  agentObjectId?: ObjectId;
  externalAgentId?: string;
  agent?: AgentDoc;
};

export async function getMerchantApiContext(
  request: Request,
): Promise<MerchantApiContext | null> {
  const rawKey = extractBearerToken(request);
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const cached = await getCachedMerchantContext(keyHash);
  const apiKey = await resolveApiKey(rawKey);
  if (!apiKey) return null;

  if (cached?.owner.username) {
    let agentObjectId: ObjectId | undefined;
    let externalAgentId: string | undefined;
    let agent: AgentDoc | undefined;

    if (apiKey.keyType === "agent" && apiKey.agentId) {
      const db = await getDb();
      const agentDoc = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
        _id: apiKey.agentId,
        workspaceId: apiKey.workspaceId,
        status: "active",
      });
      if (!agentDoc) return null;
      agent = agentDoc;
      agentObjectId = agentDoc._id;
      externalAgentId = agentDoc.externalAgentId;
    }

    return {
      ...cached,
      apiKey,
      security: extractSecurityContext(request),
      agentObjectId,
      externalAgentId,
      agent,
    };
  }

  const db = await getDb();
  const workspace = await db.collection<WorkspaceDoc>(COLLECTIONS.workspaces).findOne({
    _id: apiKey.workspaceId,
  });

  if (!workspace) return null;

  const owner = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: workspace.ownerId,
  });

  if (!owner?.username) return null;

  let agentObjectId: ObjectId | undefined;
  let externalAgentId: string | undefined;
  let agent: AgentDoc | undefined;

  if (apiKey.keyType === "agent" && apiKey.agentId) {
    const agentDoc = await db.collection<AgentDoc>(COLLECTIONS.agents).findOne({
      _id: apiKey.agentId,
      workspaceId: apiKey.workspaceId,
      status: "active",
    });
    if (!agentDoc) return null;
    agent = agentDoc;
    agentObjectId = agentDoc._id;
    externalAgentId = agentDoc.externalAgentId;
  }

  const context = { workspace, owner, apiKey, agentObjectId, externalAgentId, agent };
  await setCachedMerchantContext(keyHash, { workspace, owner });

  return {
    ...context,
    security: extractSecurityContext(request),
  };
}

export function requireAgentScopedContext(context: MerchantApiContext) {
  if (!context.agentObjectId || !context.externalAgentId) {
    return Response.json(
      { ok: false, error: "Agent-scoped API key required", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  return null;
}

export function assertAgentIdMatchesContext(
  context: MerchantApiContext,
  requestedAgentId?: string,
) {
  if (!requestedAgentId) return null;
  if (context.externalAgentId !== requestedAgentId.trim()) {
    return Response.json(
      { ok: false, error: "agentId does not match scoped key", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  return null;
}

export function requireApiPermission(context: MerchantApiContext, permission: string) {
  if (!apiKeyHasPermission(context.apiKey, permission)) {
    return Response.json(
      { ok: false, error: "Insufficient API key permissions", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  return null;
}

export function merchantApiUnauthorized() {
  return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
}

export function getWorkspaceId(context: MerchantApiContext): ObjectId {
  return context.workspace._id;
}
