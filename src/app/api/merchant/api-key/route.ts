import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  createOrRotateApiKey,
  getApiKeyOverview,
} from "@/lib/db/api-keys";
import { extractSecurityContext } from "@/lib/request-security";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getApiKeyOverview(session.workspace._id);
  return NextResponse.json(overview);
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const security = extractSecurityContext(request);
  const result = await createOrRotateApiKey({
    workspaceId: session.workspace._id,
    userId: session.user._id,
    security,
  });

  return NextResponse.json(result);
}
