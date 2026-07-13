import { NextResponse } from "next/server";

import { getWalletNetworkById } from "@/lib/wallet-networks";
import { logWalletRemovedActivity } from "@/lib/db/activity";
import { getSessionFromCookies } from "@/lib/db/auth";
import { removeVerifiedWallet } from "@/lib/db/wallets";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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

  return NextResponse.json({ ok: true });
}
