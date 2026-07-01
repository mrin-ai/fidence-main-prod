import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { createInvoice, listInvoices } from "@/lib/db/invoices";
import { invoiceFormSchema } from "@/lib/invoice/schema";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoices = await listInvoices(session.workspace._id);
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = invoiceFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invoice payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const invoice = await createInvoice({
    workspaceId: session.workspace._id,
    userId: session.user._id,
    data: parsed.data,
  });

  return NextResponse.json(invoice);
}
