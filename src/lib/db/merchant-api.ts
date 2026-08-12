import type { ObjectId } from "mongodb";

import {
  getCachedMerchantContext,
  setCachedMerchantContext,
} from "@/lib/cache/merchant-context-cache";
import { apiKeyHasPermission, extractBearerToken, hashApiKey, resolveApiKey } from "@/lib/db/api-keys";
import type { ApiKeyDoc } from "@/lib/db/merchant-types";
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
};

export async function getMerchantApiContext(
  request: Request,
): Promise<MerchantApiContext | null> {
  const rawKey = extractBearerToken(request);
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const cached = await getCachedMerchantContext(keyHash);
  if (cached?.owner.username) {
    const apiKey = await resolveApiKey(rawKey);
    if (!apiKey) return null;
    return {
      ...cached,
      apiKey,
      security: extractSecurityContext(request),
    };
  }

  const apiKey = await resolveApiKey(rawKey);
  if (!apiKey) return null;

  const db = await getDb();
  const workspace = await db.collection<WorkspaceDoc>(COLLECTIONS.workspaces).findOne({
    _id: apiKey.workspaceId,
  });

  if (!workspace) return null;

  const owner = await db.collection<UserDoc>(COLLECTIONS.users).findOne({
    _id: workspace.ownerId,
  });

  if (!owner?.username) return null;

  const context = { workspace, owner, apiKey };
  await setCachedMerchantContext(keyHash, { workspace, owner });

  return {
    ...context,
    security: extractSecurityContext(request),
  };
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
