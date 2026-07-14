import { NextResponse } from "next/server";

import { getPublicProfileByUsername } from "@/lib/db/public-profile";
import { isReservedPaymentPathSegment } from "@/lib/payment-link-url";
import { normalizeUsername } from "@/lib/db/profile";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { username: rawUsername } = await context.params;
  const username = normalizeUsername(rawUsername);

  if (isReservedPaymentPathSegment(username)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ profile }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
