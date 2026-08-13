import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import {
  deleteSavedAddress,
  updateSavedAddress,
} from "@/lib/db/saved-addresses";
import { savedAddressInputSchema } from "@/lib/pay/saved-address-schema";
import { getPaySessionContext } from "@/lib/pay/session-api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid address id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = savedAddressInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await updateSavedAddress({
    workspaceId: ctx.workspaceId,
    addressId: new ObjectId(id),
    data: parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true, address: result.address });
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = await getPaySessionContext(_request);
  if (!ctx.ok) return ctx.response;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid address id" }, { status: 400 });
  }

  const result = await deleteSavedAddress({
    workspaceId: ctx.workspaceId,
    addressId: new ObjectId(id),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
