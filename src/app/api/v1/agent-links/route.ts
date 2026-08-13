import { NextResponse } from "next/server";

import { createAgentLinkSession } from "@/lib/db/agent-links";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";
import { buildPayConnectUrl } from "@/lib/payment-link-url";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { extractSecurityContext } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isPayAgentConnectEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = extractSecurityContext(request).ip;
  const limited = await checkRateLimit(`agent-links:create:${ip}`, {
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.allowed) return rateLimitResponse(limited);

  const body = (await request.json()) as {
    publicKey?: string;
    platform?: string;
    agentName?: string;
    description?: string;
  };

  const result = await createAgentLinkSession({
    publicKey: body.publicKey ?? "",
    platform: body.platform ?? "",
    agentName: body.agentName ?? "",
    description: body.description,
    security: extractSecurityContext(request),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const requestOrigin = new URL(request.url).origin;
  return NextResponse.json({
    ok: true,
    linkId: result.linkId,
    pollSecret: result.pollSecret,
    connectUrl: buildPayConnectUrl(result.linkId, requestOrigin),
    expiresAt: result.expiresAt,
  });
}
