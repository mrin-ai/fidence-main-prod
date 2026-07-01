import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  deleteInvoice,
  getInvoiceById,
  updateInvoice,
} from "@/lib/db/invoices";
import { invoiceFormSchema } from "@/lib/invoice/schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const invoice = await getInvoiceById(session.workspace._id, id);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = invoiceFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invoice payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateInvoice({
    workspaceId: session.workspace._id,
    invoiceId: id,
    data: parsed.data,
  });

  if (!result.updated) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ reference: result.reference });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await deleteInvoice(session.workspace._id, id);
  return NextResponse.json({ ok: true });
}
