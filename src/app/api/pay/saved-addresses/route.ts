import { NextResponse } from "next/server";

import {
  createSavedAddress,
  listSavedAddresses,
} from "@/lib/db/saved-addresses";
import { savedAddressInputSchema } from "@/lib/pay/saved-address-schema";
import { getPaySessionContext } from "@/lib/pay/session-api";

export async function GET(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const addresses = await listSavedAddresses(ctx.workspaceId);
  return NextResponse.json({ ok: true, addresses });
}

export async function POST(request: Request) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const body = await request.json();
  const parsed = savedAddressInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await createSavedAddress({
    workspaceId: ctx.workspaceId,
    data: parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, address: result.address });
}
