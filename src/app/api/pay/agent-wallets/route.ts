import { NextResponse } from "next/server";

import { listLinkedAgents } from "@/lib/db/agents";
import { fetchAgentWalletBalances } from "@/lib/pay/fetch-agent-wallet-balances";
import { getPaySessionContext } from "@/lib/pay/session-api";

export async function GET(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const agents = await listLinkedAgents(ctx.workspaceId);

  const enriched = await Promise.all(
    agents.map(async (agent) => {
      const wallets = await Promise.all(
        agent.wallets.map((wallet) =>
          fetchAgentWalletBalances({
            walletId: wallet.id,
            networkId: wallet.networkId,
            address: wallet.address,
            verifiedAt: wallet.verifiedAt,
          }),
        ),
      );

      return {
        id: agent.id,
        name: agent.name,
        externalAgentId: agent.externalAgentId,
        platform: agent.platform,
        status: agent.status,
        defaultPayerWalletId: agent.defaultPayerWalletId,
        wallets,
      };
    }),
  );

  return NextResponse.json({ ok: true, agents: enriched });
}
