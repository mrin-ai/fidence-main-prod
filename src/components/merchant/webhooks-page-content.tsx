"use client";

import { useMemo, useState } from "react";
import { CopyIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WebhookEventType } from "@/lib/webhooks/dispatch";

type WebhookEndpointSummary = {
  id: string;
  url: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  secretPrefix: string;
};

export function WebhooksPageContent({
  initialEndpoints,
  eventTypes,
}: {
  initialEndpoints: WebhookEndpointSummary[];
  eventTypes: WebhookEventType[];
}) {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    "payment_link.paid",
    "agent.payment_recorded",
  ]);
  const [plainSecret, setPlainSecret] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedEventSet = useMemo(() => new Set(selectedEvents), [selectedEvents]);

  function toggleEvent(event: WebhookEventType, checked: boolean) {
    setSelectedEvents((current) =>
      checked ? [...new Set([...current, event])] : current.filter((item) => item !== event),
    );
  }

  async function handleCreate() {
    setIsCreating(true);
    try {
      const response = await fetch("/api/merchant/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      const data = (await response.json()) as {
        endpoint?: WebhookEndpointSummary;
        secret?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create webhook");
      }

      if (data.endpoint) {
        setEndpoints((current) => [data.endpoint!, ...current]);
      }
      setPlainSecret(data.secret ?? null);
      setUrl("");
      toast.success("Webhook endpoint created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(endpoint: WebhookEndpointSummary) {
    setBusyId(endpoint.id);
    try {
      const response = await fetch(`/api/merchant/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !endpoint.enabled }),
      });
      const data = (await response.json()) as {
        endpoint?: WebhookEndpointSummary;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update webhook");
      }

      if (data.endpoint) {
        setEndpoints((current) =>
          current.map((item) => (item.id === endpoint.id ? data.endpoint! : item)),
        );
      }
      toast.success(data.endpoint?.enabled ? "Webhook enabled" : "Webhook disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update webhook");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotate(endpoint: WebhookEndpointSummary) {
    setBusyId(endpoint.id);
    try {
      const response = await fetch(`/api/merchant/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateSecret: true }),
      });
      const data = (await response.json()) as {
        endpoint?: WebhookEndpointSummary;
        secret?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to rotate secret");
      }

      if (data.endpoint) {
        setEndpoints((current) =>
          current.map((item) => (item.id === endpoint.id ? data.endpoint! : item)),
        );
      }
      setPlainSecret(data.secret ?? null);
      toast.success("Signing secret rotated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate secret");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(endpoint: WebhookEndpointSummary) {
    setBusyId(endpoint.id);
    try {
      const response = await fetch(`/api/merchant/webhooks/${endpoint.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete webhook");
      }

      setEndpoints((current) => current.filter((item) => item.id !== endpoint.id));
      toast.success("Webhook deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete webhook");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Receive signed HTTP callbacks when payment links, agent payments, or
          compliance approvals change state.
        </p>
      </div>

      {plainSecret ? (
        <Card className="border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="space-y-2 p-5">
            <p className="text-xs font-medium text-amber-800">
              Copy this signing secret now. It will not be shown again.
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="break-all font-mono text-sm text-amber-950">{plainSecret}</p>
              <Button type="button" size="icon" variant="ghost" onClick={() => handleCopy(plainSecret)}>
                <CopyIcon className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://example.com/webhooks/fidence"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {eventTypes.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selectedEventSet.has(event)}
                    onCheckedChange={(checked) => toggleEvent(event, checked === true)}
                  />
                  <span className="font-mono text-xs">{event}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            disabled={isCreating || !url.trim() || selectedEvents.length === 0}
            onClick={handleCreate}
          >
            <PlusIcon className="size-4" />
            Add endpoint
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-5">
          {endpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No webhook endpoints yet. Add one to start receiving events.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.id}>
                    <TableCell className="max-w-[220px] truncate font-mono text-xs">
                      {endpoint.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {endpoint.events.map((event) => (
                          <Badge key={event} variant="secondary" className="font-mono text-[10px]">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {endpoint.secretPrefix}
                    </TableCell>
                    <TableCell>
                      <Badge variant={endpoint.enabled ? "default" : "secondary"}>
                        {endpoint.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === endpoint.id}
                          onClick={() => handleToggle(endpoint)}
                        >
                          {endpoint.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={busyId === endpoint.id}
                          onClick={() => handleRotate(endpoint)}
                        >
                          <RefreshCwIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={busyId === endpoint.id}
                          onClick={() => handleDelete(endpoint)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
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
