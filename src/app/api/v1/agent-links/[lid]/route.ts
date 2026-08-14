import { NextResponse } from "next/server";

import {
  cancelAgentLinkSession,
  pollAgentLinkSession,
} from "@/lib/db/agent-links";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type Params = { params: Promise<{ lid: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { lid } = await params;
  const pollSecret = new URL(request.url).searchParams.get("pollSecret")?.trim();
  if (!pollSecret) {
    return NextResponse.json({ error: "pollSecret query param is required" }, { status: 400 });
  }

  return handlePoll(lid, pollSecret);
}

export async function POST(request: Request, { params }: Params) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { lid } = await params;
  const body = (await request.json()) as { pollSecret?: string };
  const pollSecret = body.pollSecret?.trim();
  if (!pollSecret) {
    return NextResponse.json({ error: "pollSecret is required" }, { status: 400 });
  }

  return handlePoll(lid, pollSecret);
}

async function handlePoll(lid: string, pollSecret: string) {
  const limited = await checkRateLimit(`agent-links:poll:${lid}`, {
    max: 120,
    windowMs: 60 * 1000,
  });
  if (!limited.allowed) return rateLimitResponse(limited);

  const result = await pollAgentLinkSession({ linkId: lid, pollSecret });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request, { params }: Params) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { lid } = await params;
  const body = (await request.json()) as { pollSecret?: string };
  const pollSecret = body.pollSecret?.trim();
  if (!pollSecret) {
    return NextResponse.json({ error: "pollSecret is required" }, { status: 400 });
  }

  const result = await cancelAgentLinkSession({ linkId: lid, pollSecret });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
