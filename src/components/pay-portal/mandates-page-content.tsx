"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { AgentPolicy, AgentPolicyInput } from "@/lib/compliance/types";
import type { LinkedAgentSummary } from "@/lib/pay/types";
import { createEmptyPolicyInput } from "@/lib/compliance/policy-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RemoveLinkedAgentButton } from "@/components/pay-portal/remove-linked-agent-button";
import { dashboardCardClassName } from "@/lib/dashboard-styles";

export function PayMandatesPageContent() {
  const [agents, setAgents] = useState<LinkedAgentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<AgentPolicyInput>(createEmptyPolicyInput());
  const [loading, setLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    const res = await fetch("/api/pay/linked-agents");
    const data = (await res.json()) as { agents?: LinkedAgentSummary[] };
    const list = data.agents ?? [];
    setAgents(list);
    setSelectedId((current) => {
      if (current && list.some((agent) => agent.id === current)) return current;
      return list[0]?.id ?? null;
    });
  }, []);

  const loadPolicy = useCallback(async (agentId: string) => {
    const res = await fetch(`/api/pay/mandates/${agentId}`);
    const data = (await res.json()) as { policy?: AgentPolicy | null };
    if (data.policy) {
      setPolicy({
        status: data.policy.status,
        maxAmountPerPayment: data.policy.maxAmountPerPayment,
        dailySpendCap: data.policy.dailySpendCap,
        monthlySpendCap: data.policy.monthlySpendCap,
        allowedNetworkIds: data.policy.allowedNetworkIds,
        allowedTokenIds: data.policy.allowedTokenIds,
        allowCreatePaymentLinks: data.policy.allowCreatePaymentLinks,
        allowPay: data.policy.allowPay,
        autoPayEnabled: data.policy.autoPayEnabled === true,
        requireApprovalAbove: data.policy.requireApprovalAbove,
      });
    } else {
      setPolicy(createEmptyPolicyInput());
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (selectedId) void loadPolicy(selectedId);
  }, [selectedId, loadPolicy]);

  async function savePolicy() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/mandates/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save mandate");
        return;
      }
      toast.success("Mandate saved");
    } finally {
      setLoading(false);
    }
  }

  const selected = agents.find((agent) => agent.id === selectedId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Mandates</h1>
        <p className="text-sm text-muted-foreground">
          Spending rules for linked agents only.
        </p>
      </div>

      {agents.length === 0 ? (
        <Card className={dashboardCardClassName}>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Connect a linked agent first on the Agents tab.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className={dashboardCardClassName}>
            <CardHeader>
              <CardTitle className="text-base">Agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                    selectedId === agent.id ? "border-primary bg-muted/40" : "border-border"
                  }`}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <span>{agent.name}</span>
                  <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                    {agent.status}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className={dashboardCardClassName}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">{selected?.name ?? "Mandate"}</CardTitle>
                <CardDescription>Caps, allowed assets, and approval thresholds.</CardDescription>
              </div>
              {selected ? (
                <RemoveLinkedAgentButton agentId={selected.id} agentName={selected.name} onRemoved={() => void loadAgents()} />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Active mandate</p>
                  <p className="text-xs text-muted-foreground">Allow this agent to spend within limits.</p>
                </div>
                <Switch
                  checked={policy.status === "active"}
                  onCheckedChange={(checked) =>
                    setPolicy((prev) => ({ ...prev, status: checked ? "active" : "draft" }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Automatic payments</p>
                  <p className="text-xs text-muted-foreground">
                    Skip approval popup when payment is within mandate limits.
                  </p>
                </div>
                <Switch
                  checked={policy.autoPayEnabled}
                  onCheckedChange={(checked) =>
                    setPolicy((prev) => ({ ...prev, autoPayEnabled: checked }))
                  }
                />
              </div>

              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Max per payment (USD)</FieldLabel>
                  <Input
                    type="number"
                    value={policy.maxAmountPerPayment}
                    onChange={(event) =>
                      setPolicy((prev) => ({
                        ...prev,
                        maxAmountPerPayment: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Daily cap (USD)</FieldLabel>
                  <Input
                    type="number"
                    value={policy.dailySpendCap}
                    onChange={(event) =>
                      setPolicy((prev) => ({
                        ...prev,
                        dailySpendCap: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Monthly cap (USD)</FieldLabel>
                  <Input
                    type="number"
                    value={policy.monthlySpendCap ?? ""}
                    onChange={(event) =>
                      setPolicy((prev) => ({
                        ...prev,
                        monthlySpendCap: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Require approval above (USD)</FieldLabel>
                  <Input
                    type="number"
                    value={policy.requireApprovalAbove ?? ""}
                    onChange={(event) =>
                      setPolicy((prev) => ({
                        ...prev,
                        requireApprovalAbove: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
              </FieldGroup>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={policy.allowPay}
                    onCheckedChange={(checked) =>
                      setPolicy((prev) => ({ ...prev, allowPay: checked }))
                    }
                  />
                  Allow pay
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={policy.allowCreatePaymentLinks}
                    onCheckedChange={(checked) =>
                      setPolicy((prev) => ({ ...prev, allowCreatePaymentLinks: checked }))
                    }
                  />
                  Allow payment links
                </label>
              </div>

              <Button onClick={() => void savePolicy()} disabled={loading}>
                Save mandate
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
