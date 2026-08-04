"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BotIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { AgentListItem } from "@/lib/merchant-ui-types";
import type { AgentPolicy } from "@/lib/compliance/types";
import {
  formatLimitsSummary,
  getComplianceStatus,
  getPolicyStatus,
} from "@/lib/compliance/policy-helpers";
import {
  dismissServerSyncBanner,
  fetchComplianceApprovals,
  fetchComplianceAudit,
  listPolicies,
  resolveComplianceApproval,
  shouldShowServerSyncBanner,
} from "@/lib/compliance/policy-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function statusLabel(
  agent: AgentListItem,
  policy: AgentPolicy | null,
): { label: string; hint: string; ok: boolean } {
  const compliance = getComplianceStatus(agent, policy);
  const policyStatus = getPolicyStatus(policy);

  if (compliance === "compliant") {
    return {
      label: "Ready",
      hint: formatLimitsSummary(policy),
      ok: true,
    };
  }

  if (agent.status !== "active") {
    return { label: "Blocked", hint: "Agent disabled", ok: false };
  }
  if (policyStatus === "none") {
    return { label: "Blocked", hint: "Needs a policy", ok: false };
  }
  if (policyStatus === "draft") {
    return { label: "Blocked", hint: "Activate policy to run", ok: false };
  }

  return { label: "Blocked", hint: "Cannot run", ok: false };
}

export function CompliancePageContent({
  agents,
}: {
  agents: AgentListItem[];
}) {
  const [policies, setPolicies] = useState<Record<string, AgentPolicy>>({});
  const [showBanner, setShowBanner] = useState(false);
  const [ipFilter, setIpFilter] = useState("");
  const [decisions, setDecisions] = useState<
    Array<{
      receiptId: string;
      action: string;
      verdict: string;
      codes: string[];
      actor: { actorType: string; ip: string };
      externalAgentId?: string | null;
      createdAt: string;
    }>
  >([]);
  const [approvals, setApprovals] = useState<
    Array<{
      approvalId: string;
      status: string;
      amountUsd: number;
      tokenId: string;
      networkId: string;
      externalAgentId: string;
      requestedBy: { ip: string };
      resolvedBy: { ip: string } | null;
      createdAt: string;
    }>
  >([]);
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);

  async function refreshAudit(ip?: string) {
    try {
      const data = await fetchComplianceAudit({
        ip: ip?.trim() || undefined,
        limit: 40,
      });
      setDecisions(data.decisions);
    } catch {
      toast.error("Failed to load audit trail");
    }
  }

  async function refreshApprovals() {
    try {
      const data = await fetchComplianceApprovals();
      setApprovals(data.approvals);
    } catch {
      toast.error("Failed to load approvals");
    }
  }

  useEffect(() => {
    setShowBanner(shouldShowServerSyncBanner());
    listPolicies()
      .then(setPolicies)
      .catch(() => toast.error("Failed to load policies"));
    void refreshAudit();
    void refreshApprovals();
  }, []);

  const readyCount = useMemo(
    () =>
      agents.filter(
        (agent) =>
          getComplianceStatus(agent, policies[agent.id] ?? null) === "compliant",
      ).length,
    [agents, policies],
  );

  async function handleApproval(
    approvalId: string,
    decision: "approve" | "reject",
  ) {
    setBusyApprovalId(approvalId);
    try {
      await resolveComplianceApproval(approvalId, decision);
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      await refreshApprovals();
      await refreshAudit(ipFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyApprovalId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Compliance Engine
          </h2>
          <p className="text-sm text-muted-foreground">
            Set rules before an agent can create links or pay.
          </p>
        </div>
        {agents.length > 0 ? (
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {readyCount}/{agents.length} ready
          </p>
        ) : null}
      </div>

      {showBanner ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <p>
            Policies now sync to the server. Re-activate any policy you only
            saved locally before.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              dismissServerSyncBanner();
              setShowBanner(false);
            }}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden border-border/60 shadow-none">
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <BotIcon className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No agents yet</p>
                <p className="text-sm text-muted-foreground">
                  Register an agent, then set its policy here.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/merchant/agents" />}
              >
                Registered agents
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {agents.map((agent) => {
                const policy = policies[agent.id] ?? null;
                const policyStatus = getPolicyStatus(policy);
                const status = statusLabel(agent, policy);
                const hasPolicy = policyStatus !== "none";
                const href = `/merchant/compliance/${agent.id}`;

                return (
                  <li key={agent.id}>
                    <Link
                      href={href}
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                          status.ok
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border/70 bg-muted/50 text-muted-foreground",
                        )}
                      >
                        <BotIcon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {agent.name}
                          </p>
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              status.ok ? "bg-emerald-500" : "bg-rose-500",
                            )}
                            aria-hidden
                          />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{agent.publicId}</span>
                          <span className="mx-1.5 text-border">·</span>
                          {status.hint}
                        </p>
                      </div>

                      <Badge
                        variant="secondary"
                        className={cn(
                          "hidden sm:inline-flex",
                          status.ok
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-rose-50 text-rose-800",
                        )}
                      >
                        {status.label}
                      </Badge>

                      <span
                        className={cn(
                          "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[0.8rem] font-medium transition-colors",
                          hasPolicy
                            ? "border-border bg-background text-foreground group-hover:bg-muted"
                            : "border-transparent bg-primary text-primary-foreground group-hover:bg-primary/80",
                        )}
                      >
                        {hasPolicy ? "Edit" : "Set policy"}
                        <ChevronRightIcon className="size-3.5 opacity-70" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Pending approvals</h3>
          <p className="text-xs text-muted-foreground">
            High-value pays waiting for owner/admin approval. Approve unlocks
            the intent — the agent still submits the on-chain payment.
          </p>
        </div>
        <Card className="border-border/60 shadow-none">
          <CardContent className="divide-y divide-border/60 p-0">
            {approvals.filter((item) => item.status === "pending").length ===
            0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No pending approvals.
              </p>
            ) : (
              approvals
                .filter((item) => item.status === "pending")
                .map((item) => (
                  <div
                    key={item.approvalId}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {item.externalAgentId} · ${item.amountUsd}{" "}
                        {item.tokenId.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Agent IP {item.requestedBy.ip} · {item.networkId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyApprovalId === item.approvalId}
                        onClick={() => handleApproval(item.approvalId, "reject")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyApprovalId === item.approvalId}
                        onClick={() =>
                          handleApproval(item.approvalId, "approve")
                        }
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Audit trail</h3>
            <p className="text-xs text-muted-foreground">
              Decisions and policy changes with actor IP.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={ipFilter}
              onChange={(event) => setIpFilter(event.target.value)}
              placeholder="Filter by IP"
              className="h-8 w-40"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshAudit(ipFilter)}
            >
              Filter
            </Button>
          </div>
        </div>
        <Card className="border-border/60 shadow-none">
          <CardContent className="divide-y divide-border/60 p-0">
            {decisions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No decisions yet.
              </p>
            ) : (
              decisions.map((decision) => (
                <div key={decision.receiptId} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {decision.action} · {decision.verdict}
                    </p>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(decision.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {decision.actor.actorType} · IP {decision.actor.ip}
                    {decision.externalAgentId
                      ? ` · ${decision.externalAgentId}`
                      : ""}
                    {decision.codes.length
                      ? ` · ${decision.codes.join(", ")}`
                      : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
