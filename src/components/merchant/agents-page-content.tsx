"use client";

import { useState } from "react";
import type { AgentListItem } from "@/lib/merchant-ui-types";
import { truncateAddress } from "@/lib/profile-url";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function formatAgentWalletLabel(address?: string | null) {
  if (!address) return "—";
  return truncateAddress(address, 6);
}

export function AgentsPageContent({
  agents: initialAgents,
  maxAgents,
}: {
  agents: AgentListItem[];
  maxAgents: number;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function toggleAgentStatus(agent: AgentListItem) {
    const nextStatus = agent.status === "active" ? "inactive" : "active";
    setUpdatingId(agent.id);

    try {
      const response = await fetch(`/api/merchant/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        agent?: { status: AgentListItem["status"] };
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update agent");
      }

      setAgents((current) =>
        current.map((item) =>
          item.id === agent.id
            ? { ...item, status: data.agent?.status ?? nextStatus }
            : item,
        ),
      );
      toast.success(
        nextStatus === "active" ? "Agent enabled" : "Agent disabled",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update agent",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Registered Agents</h2>
        <p className="text-sm text-muted-foreground">
          {agents.length}/{maxAgents} agents registered via API
        </p>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-5">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agents yet. Register one with{" "}
              <span className="font-mono text-xs">
                POST /api/v1/agents/register
              </span>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="text-sm font-medium">
                      {agent.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {agent.publicId}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatAgentWalletLabel(agent.walletAddress)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.linksCreated}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          agent.status === "active"
                            ? "capitalize"
                            : "capitalize bg-muted text-muted-foreground"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updatingId === agent.id}
                        onClick={() => toggleAgentStatus(agent)}
                      >
                        {agent.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
