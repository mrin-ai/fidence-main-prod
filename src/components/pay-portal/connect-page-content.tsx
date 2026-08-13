"use client";

import { useEffect, useState } from "react";
import { Link2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dashboardCardClassName } from "@/lib/dashboard-styles";
import { cn } from "@/lib/utils";

type LinkSession = {
  linkId: string;
  agentName: string;
  platform: string;
  description?: string;
  status: string;
  expiresAt: string;
};

function PayConnectShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <Card className={dashboardCardClassName}>
        <CardHeader className="gap-1">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/30 text-muted-foreground">
              <Link2Icon className="size-4" />
            </div>
            <div className="space-y-1">
              <CardTitle className="font-serif text-2xl font-normal tracking-tight">
                {title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function SessionDetails({ session }: { session: LinkSession }) {
  const rows = [
    { label: "Agent", value: session.agentName },
    { label: "Platform", value: session.platform },
    { label: "Status", value: session.status, badge: true },
  ] as const;

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          {"badge" in row && row.badge ? (
            <Badge variant={session.status === "pending" ? "secondary" : "default"}>
              {row.value}
            </Badge>
          ) : (
            <span className="font-medium text-foreground">{row.value}</span>
          )}
        </div>
      ))}
      {session.description ? (
        <p className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
          {session.description}
        </p>
      ) : null}
    </div>
  );
}

export function PayConnectPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lid = searchParams.get("lid")?.trim() ?? "";
  const [session, setSession] = useState<LinkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!lid) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/pay/link-sessions/${encodeURIComponent(lid)}`);
        const data = (await res.json()) as { session?: LinkSession; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Link session not found");
          return;
        }
        setSession(data.session ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [lid]);

  async function handleAction(action: "approve" | "reject") {
    if (!lid) return;
    setActing(true);
    try {
      const res = await fetch(`/api/pay/link-sessions/${encodeURIComponent(lid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Action failed");
        return;
      }
      toast.success(action === "approve" ? "Agent connected" : "Link rejected");
      router.push("/pay/agents");
      router.refresh();
    } finally {
      setActing(false);
    }
  }

  if (!lid) {
    return (
      <PayConnectShell
        title="Authorize agent"
        description="Paste the link ID from your agent setup, or reopen the full authorization URL."
      >
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("lid");
            if (typeof value === "string" && value.trim()) {
              router.push(`/pay/connect?lid=${encodeURIComponent(value.trim())}`);
            }
          }}
        >
          <Input name="lid" placeholder="lnk_…" className="flex-1" />
          <Button type="submit" className="sm:min-w-28">
            Continue
          </Button>
        </form>
      </PayConnectShell>
    );
  }

  if (loading) {
    return (
      <PayConnectShell
        title="Authorize agent"
        description="Loading connection request…"
      >
        <p className="text-sm text-muted-foreground">Loading link session…</p>
      </PayConnectShell>
    );
  }

  if (!session) {
    return (
      <PayConnectShell
        title="Authorize agent"
        description="This link session could not be found."
      >
        <p className="text-sm text-muted-foreground">
          The session may have expired. Run <code className="rounded bg-muted px-1">fidence setup</code>{" "}
          again in your agent to get a new link.
        </p>
      </PayConnectShell>
    );
  }

  return (
    <PayConnectShell
      title="Authorize agent"
      description="Review this connection request before granting scoped agent access."
    >
      <div className="space-y-6">
        <SessionDetails session={session} />

        {session.status === "pending" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => void handleAction("approve")}
              disabled={acting}
            >
              Approve connection
            </Button>
            <Button
              className={cn("flex-1", "sm:flex-1")}
              variant="outline"
              onClick={() => void handleAction("reject")}
              disabled={acting}
            >
              Reject
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This link session is {session.status}.
          </p>
        )}
      </div>
    </PayConnectShell>
  );
}
