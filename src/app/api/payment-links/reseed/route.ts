import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { seedPaymentLinksForWorkspace } from "@/lib/db/seed-payment-links";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = Math.min(Math.max(Number(body.count) || 50, 1), 100);

  const result = await seedPaymentLinksForWorkspace({
    workspaceId: session.workspace._id,
    userId: session.user._id,
    count,
  });

  return NextResponse.json(result);
}
