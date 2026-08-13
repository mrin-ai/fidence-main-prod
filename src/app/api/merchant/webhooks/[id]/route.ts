import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  deleteWebhookEndpoint,
  isWebhookEventType,
  rotateWebhookSecret,
  updateWebhookEndpoint,
} from "@/lib/db/webhooks";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

type Params = {
  params: Promise<{ id: string }>;
};

function parseEndpointId(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function parseEvents(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false as const, error: "Select at least one event" };
  }
  const events = value.map((item) => String(item));
  if (!events.every(isWebhookEventType)) {
    return { ok: false as const, error: "Invalid webhook event type" };
  }
  return { ok: true as const, events };
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const endpointId = parseEndpointId(id);
  if (!endpointId) {
    return NextResponse.json({ error: "Invalid endpoint id" }, { status: 400 });
  }

  let body: {
    url?: string;
    events?: unknown;
    enabled?: boolean;
    rotateSecret?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.rotateSecret) {
    const rotated = await rotateWebhookSecret(session.workspace._id, endpointId);
    if (!rotated) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }
    return NextResponse.json({
      endpoint: rotated.endpoint,
      secret: rotated.secret,
    });
  }

  if (body.url !== undefined) {
    const urlCheck = validateWebhookUrl(body.url);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    body.url = urlCheck.url;
  }

  let events: ReturnType<typeof parseEvents> | undefined;
  if (body.events !== undefined) {
    events = parseEvents(body.events);
    if (!events.ok) {
      return NextResponse.json({ error: events.error }, { status: 400 });
    }
  }

  const updated = await updateWebhookEndpoint({
    workspaceId: session.workspace._id,
    endpointId,
    url: body.url?.trim(),
    events: events?.ok ? events.events : undefined,
    enabled: body.enabled,
  });

  if (!updated) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  return NextResponse.json({ endpoint: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const endpointId = parseEndpointId(id);
  if (!endpointId) {
    return NextResponse.json({ error: "Invalid endpoint id" }, { status: 400 });
  }

  const deleted = await deleteWebhookEndpoint(session.workspace._id, endpointId);
  if (!deleted) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
