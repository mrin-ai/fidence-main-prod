import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth-session";
import { getWalletNetworkById } from "@/lib/wallet-networks";
import { logWalletRemovedActivity } from "@/lib/db/activity";
import {
  getSessionFromCookies,
  refreshSessionFromDatabase,
} from "@/lib/db/auth";
import { removeVerifiedWallet } from "@/lib/db/wallets";
import { logWorkspaceSecurityEvent } from "@/lib/security-logging";
import { extractSecurityContext } from "@/lib/request-security";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await removeVerifiedWallet(session.user._id, id);

  if (!result.ok) {
    const status = result.error === "Wallet not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (token) {
    await refreshSessionFromDatabase(token);
  }

  const network = getWalletNetworkById(result.wallet.networkId);
  await logWalletRemovedActivity({
    workspaceId: session.workspace._id,
    networkLabel: network?.label ?? result.wallet.networkId,
    address: result.wallet.address,
  });

  await logWorkspaceSecurityEvent({
    workspaceId: session.workspace._id,
    actorType: "user",
    actorId: session.user._id.toString(),
    action: "human_wallet_removed",
    resourceType: "wallet",
    resourceId: result.wallet.id,
    security: extractSecurityContext(request),
  });

  return NextResponse.json({ ok: true });
}
