"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CreditCardIcon,
  InfoIcon,
  Link2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { ConnectAgentDialog } from "@/components/pay-portal/connect-agent-dialog";
import type { LinkedAgentSummary } from "@/lib/pay/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import { cn } from "@/lib/utils";

type SetupStep = "connect" | "address" | "mandate";

const STEPS: Array<{
  id: SetupStep;
  title: string;
  description: string;
  icon: typeof Link2Icon;
  href?: string;
}> = [
  {
    id: "connect",
    title: "Connect an agent",
    description: "Link an AI agent and pick which actions it can take.",
    icon: Link2Icon,
  },
  {
    id: "address",
    title: "Save a billing address",
    description: "Add a contact for receipts and agent payment approvals.",
    icon: CreditCardIcon,
    href: "/pay/addresses",
  },
  {
    id: "mandate",
    title: "Approve a mandate",
    description: "Set spending limits and rules for your agent.",
    icon: ShieldCheckIcon,
    href: "/pay/mandates",
  },
];

function StepCard({
  step,
  active,
  complete,
}: {
  step: (typeof STEPS)[number];
  active: boolean;
  complete: boolean;
}) {
  const Icon = step.icon;
  const content = (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-lg border bg-background p-5 transition-colors",
        active ? "border-primary ring-1 ring-primary/20" : "border-border/80",
        complete && !active && "border-border/60 bg-muted/20",
        step.href && "hover:border-primary/40",
      )}
    >
      {active ? (
        <span className="absolute right-4 top-4 size-2 rounded-sm bg-primary" />
      ) : complete ? (
        <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <CheckIcon className="size-3" />
        </span>
      ) : null}
      <div
        className={cn(
          "mb-4 flex size-10 items-center justify-center rounded-md border",
          active || complete
            ? "border-primary/20 bg-primary/5 text-primary"
            : "border-border bg-muted/30 text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
    </div>
  );

  if (step.href) {
    return (
      <Link href={step.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

export function PayAgentsPageContent() {
  const [agents, setAgents] = useState<LinkedAgentSummary[]>([]);
  const [addressCount, setAddressCount] = useState(0);
  const [mandateComplete, setMandateComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, addressesRes] = await Promise.all([
        fetch("/api/pay/linked-agents"),
        fetch("/api/pay/saved-addresses"),
      ]);
      const agentsData = (await agentsRes.json()) as { agents?: LinkedAgentSummary[] };
      const addressesData = (await addressesRes.json()) as { addresses?: unknown[] };
      const nextAgents = agentsData.agents ?? [];
      setAgents(nextAgents);
      setAddressCount(addressesData.addresses?.length ?? 0);

      if (nextAgents.length === 0) {
        setMandateComplete(false);
        return;
      }

      const policyResponses = await Promise.all(
        nextAgents.map(async (agent) => {
          const res = await fetch(`/api/pay/mandates/${agent.id}`);
          return (await res.json()) as { policy?: { status?: string } | null };
        }),
      );
      setMandateComplete(
        policyResponses.some((entry) => entry.policy?.status === "active"),
      );
    } catch {
      setAgents([]);
      setAddressCount(0);
      setMandateComplete(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleFocus() {
      void load();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [load]);

  const setupComplete =
    agents.length > 0 && addressCount > 0 && mandateComplete;

  const activeStep = useMemo<SetupStep | null>(() => {
    if (setupComplete) return null;
    if (agents.length === 0) return "connect";
    if (addressCount === 0) return "address";
    return "mandate";
  }, [agents.length, addressCount, setupComplete]);

  const stepComplete = useMemo(
    () => ({
      connect: agents.length > 0,
      address: addressCount > 0,
      mandate: mandateComplete,
    }),
    [agents.length, addressCount, mandateComplete],
  );

  const primaryAction = useMemo(() => {
    if (activeStep === "address") {
      return { label: "Add billing address", href: "/pay/addresses" as const };
    }
    if (activeStep === "mandate") {
      return { label: "Set up mandate", href: "/pay/mandates" as const };
    }
    return { label: "Connect Agent", action: "connect" as const };
  }, [activeStep]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      {!setupComplete ? (
        <Card className={dashboardCardClassName}>
          <CardHeader className="gap-1">
            <CardTitle className="font-serif text-2xl font-normal tracking-tight">
              Get started
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Three steps to start sending payments through your agent.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  active={activeStep === step.id}
                  complete={stepComplete[step.id]}
                />
              ))}
            </div>

            {"href" in primaryAction && primaryAction.href ? (
              <Button nativeButton={false} render={<Link href={primaryAction.href} />}>
                {primaryAction.label}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => setConnectOpen(true)}>
                {primaryAction.label}
                <ArrowRightIcon className="ml-2 size-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-normal tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Your agent is connected and ready for payments.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setConnectOpen(true)}>
            Connect another agent
          </Button>
        </div>
      )}

      <Card className={cn(dashboardCardClassName, "bg-muted/30")}>
        <CardContent className="flex gap-4 pt-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-muted-foreground">
            <InfoIcon className="size-4" />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">How Fidence Pay works</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your agent never sees your wallet keys. Linked agents receive scoped permissions only,
              and every payment runs through your mandates and approval rules before funds move.
            </p>
            <Link
              href="/docs"
              className="inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Learn more
              <ArrowRightIcon className="ml-1 size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {agents.length > 0 ? (
        <Card className={dashboardCardClassName}>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-sm">Linked agents</CardTitle>
              <p className="text-xs text-muted-foreground">Agents connected via Fidence Pay</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCwIcon className="mr-2 size-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="px-2 pb-2 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wallets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell>{agent.platform ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{agent.wallets.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <ConnectAgentDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}
