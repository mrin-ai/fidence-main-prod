import { NextResponse } from "next/server";

import { getWalletNetworkById } from "@/lib/wallet-networks";
import { logWalletRemovedActivity } from "@/lib/db/activity";
import { getSessionFromCookies } from "@/lib/db/auth";
import {
  removeVerifiedWallet,
  updateVerifiedWalletLabel,
} from "@/lib/db/wallets";
import { logWorkspaceSecurityEvent } from "@/lib/security-logging";
import { extractSecurityContext } from "@/lib/request-security";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    label?: string;
  } | null;

  const result = await updateVerifiedWalletLabel(
    session.user._id,
    id,
    body?.label,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const network = getWalletNetworkById(result.wallet.networkId);
  return NextResponse.json({
    wallet: {
      id: result.wallet.id,
      networkId: result.wallet.networkId,
      networkLabel: network?.label ?? result.wallet.networkId,
      address: result.wallet.address,
      label: result.wallet.label,
      verifiedAt: result.wallet.verifiedAt.toISOString(),
    },
  });
}

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
