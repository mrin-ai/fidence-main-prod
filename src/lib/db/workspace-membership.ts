import type { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { WorkspaceMemberDoc } from "@/lib/db/types";

export type WorkspaceMemberRole = "owner" | "admin" | "member";

export async function getWorkspaceMembership(
  workspaceId: ObjectId,
  userId: ObjectId,
) {
  const db = await getDb();
  return db.collection<WorkspaceMemberDoc>(COLLECTIONS.workspaceMembers).findOne({
    workspaceId,
    userId,
  });
}

export function canMutateCompliance(role: WorkspaceMemberRole | undefined) {
  return role === "owner" || role === "admin";
}
