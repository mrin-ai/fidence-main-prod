import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import {
  deleteInvoice,
  getInvoiceById,
  saveInvoiceWithPaymentLink,
} from "@/lib/db/invoices";
import { invoiceFormSchema } from "@/lib/invoice/schema";

type RouteContext = { params: Promise<{ id: string }> };

function invoiceSaveRequirements(session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>) {
  if (!session.user.username) {
    return {
      error: "Set a username in Settings before saving invoices with payment links",
      code: "USERNAME_REQUIRED",
    };
  }

  const recipientAddress = session.user.walletAddresses[0];
  if (!recipientAddress) {
    return {
      error: "Connect a wallet to your account to receive invoice payments",
      code: "WALLET_REQUIRED",
    };
  }

  return {
    username: session.user.username,
    recipientAddress,
  };
}

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

  const requirements = invoiceSaveRequirements(session);
  if ("error" in requirements) {
    return NextResponse.json(requirements, { status: 400 });
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

  try {
    const invoice = await saveInvoiceWithPaymentLink({
      workspaceId: session.workspace._id,
      userId: session.user._id,
      username: requirements.username,
      recipientAddress: requirements.recipientAddress,
      data: parsed.data,
      invoiceId: id,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save invoice";
    const status = message === "Invoice not found" ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
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
