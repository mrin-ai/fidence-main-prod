import type { ObjectId } from "mongodb";

import {
  getCachedMerchantContext,
  setCachedMerchantContext,
} from "@/lib/cache/merchant-context-cache";
import { extractBearerToken, hashApiKey, resolveApiKey } from "@/lib/db/api-keys";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { SecurityContext } from "@/lib/db/merchant-types";
import type { UserDoc, WorkspaceDoc } from "@/lib/db/types";
import { extractSecurityContext } from "@/lib/request-security";

export type MerchantApiContext = {
  workspace: WorkspaceDoc;
  owner: UserDoc;
  security: SecurityContext;
};

export async function getMerchantApiContext(
  request: Request,
): Promise<MerchantApiContext | null> {
  const rawKey = extractBearerToken(request);
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const cached = await getCachedMerchantContext(keyHash);
  if (cached?.owner.username) {
    return {
      ...cached,
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

  const context = { workspace, owner };
  await setCachedMerchantContext(keyHash, context);

  return {
    ...context,
    security: extractSecurityContext(request),
  };
}

export function merchantApiUnauthorized() {
  return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
}

export function getWorkspaceId(context: MerchantApiContext): ObjectId {
  return context.workspace._id;
}
