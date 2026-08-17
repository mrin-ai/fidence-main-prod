"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import type { AgentWalletBalanceView } from "@/lib/pay/fetch-agent-wallet-balances";
import { RemoveLinkedAgentButton } from "@/components/pay-portal/remove-linked-agent-button";
import { cn } from "@/lib/utils";

type AgentWalletGroup = {
  id: string;
  name: string;
  externalAgentId: string;
  platform?: string;
  status: "active" | "inactive";
  wallets: AgentWalletBalanceView[];
};

function truncateAddress(address: string) {
  if (address.length <= 16) return address;
  if (address.startsWith("0x")) {
    return `${address.slice(0, 8)}…${address.slice(-6)}`;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function WalletRow({ wallet }: { wallet: AgentWalletBalanceView }) {
  async function copyAddress() {
    await navigator.clipboard.writeText(wallet.address);
    toast.success("Address copied");
  }

  return (
    <div className="rounded-lg border border-border/80 bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {wallet.networkIcon ? (
            <Image
              src={wallet.networkIcon}
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full"
            />
          ) : (
            <div className="size-6 rounded-full bg-muted" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{wallet.networkLabel}</p>
            <p className="font-mono text-xs text-muted-foreground">{truncateAddress(wallet.address)}</p>
          </div>
        </div>
        <Badge variant="secondary">{wallet.networkId}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="max-w-full break-all rounded bg-background px-2 py-1 text-xs text-muted-foreground">
          {wallet.address}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyAddress()}>
          <CopyIcon className="size-3.5" />
          Copy
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {wallet.balances.map((line) => (
          <div
            key={`${wallet.walletId}-${line.tokenId}`}
            className="rounded-md border border-border/60 bg-background px-3 py-2"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{line.symbol}</p>
            <p className="text-sm font-medium text-foreground">{line.amount}</p>
          </div>
        ))}
        {wallet.balanceError ? (
          <p className="text-sm text-destructive sm:col-span-3">{wallet.balanceError}</p>
        ) : null}
        {!wallet.balanceError && wallet.balances.length === 0 ? (
          <p className="text-sm text-muted-foreground sm:col-span-3">No balance data</p>
        ) : null}
      </div>
    </div>
  );
}

export function PayWalletsPageContent() {
  const [agents, setAgents] = useState<AgentWalletGroup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallets = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/pay/agent-wallets");
      const data = (await res.json()) as { agents?: AgentWalletGroup[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to load wallets");
        return;
      }

      const list = data.agents ?? [];
      setAgents(list);
      setSelectedId((current) => {
        if (current && list.some((agent) => agent.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const selected = agents.find((agent) => agent.id === selectedId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">Wallets</h1>
          <p className="text-sm text-muted-foreground">
            Agent spending wallets by chain — fund these addresses for auto-pay.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void loadWallets(true)}
        >
          <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
          Refresh balances
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading agent wallets…</p>
      ) : agents.length === 0 ? (
        <Card className={dashboardCardClassName}>
          <CardHeader>
            <CardTitle className="font-serif text-xl font-normal">No agent wallets yet</CardTitle>
            <CardDescription>
              Connect an agent from the Agents tab to generate spending wallets.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <Card className={dashboardCardClassName}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedId(agent.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selectedId === agent.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border/70 hover:border-primary/30",
                  )}
                >
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                    {agent.status}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selected ? (
              <>
                <Card className={dashboardCardClassName}>
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="font-serif text-xl font-normal">{selected.name}</CardTitle>
                      <CardDescription>
                        {selected.wallets.length} chain{selected.wallets.length === 1 ? "" : "s"} ·{" "}
                        <span className="font-mono text-xs">{selected.externalAgentId}</span>
                      </CardDescription>
                    </div>
                    <RemoveLinkedAgentButton
                      agentId={selected.id}
                      agentName={selected.name}
                      onRemoved={() => void loadWallets()}
                    />
                  </CardHeader>
                </Card>

                {selected.wallets.length === 0 ? (
                  <Card className={dashboardCardClassName}>
                    <CardContent className="py-6 text-sm text-muted-foreground">
                      This agent has no spending wallets. Reconnect via{" "}
                      <code className="rounded bg-muted px-1">fidence setup</code> to generate them.
                    </CardContent>
                  </Card>
                ) : (
                  selected.wallets.map((wallet) => (
                    <WalletRow key={wallet.walletId} wallet={wallet} />
                  ))
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
