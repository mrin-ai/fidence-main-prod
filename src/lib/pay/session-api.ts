import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { extractSecurityContext } from "@/lib/request-security";
import { isPayAgentConnectEnabled } from "@/lib/pay/config";

export async function getPaySessionContext(request: Request) {
  if (!isPayAgentConnectEnabled()) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true as const,
    session,
    workspaceId: session.workspace._id,
    userId: session.user._id,
    security: extractSecurityContext(request),
  };
}

export function payFeatureDisabledResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
