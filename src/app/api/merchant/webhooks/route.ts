import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  createWebhookEndpoint,
  isWebhookEventType,
  listWebhookEndpoints,
  listWebhookEventTypes,
} from "@/lib/db/webhooks";
import { validateWebhookUrl } from "@/lib/webhooks/validate-url";

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

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpoints = await listWebhookEndpoints(session.workspace._id);
  return NextResponse.json({
    endpoints,
    eventTypes: listWebhookEventTypes(),
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string; events?: unknown; enabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const urlCheck = validateWebhookUrl(url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  const parsedEvents = parseEvents(body.events);
  if (!parsedEvents.ok) {
    return NextResponse.json({ error: parsedEvents.error }, { status: 400 });
  }

  const created = await createWebhookEndpoint({
    workspaceId: session.workspace._id,
    url: urlCheck.url,
    events: parsedEvents.events,
    enabled: body.enabled,
  });

  return NextResponse.json({
    endpoint: created.endpoint,
    secret: created.secret,
  });
}
