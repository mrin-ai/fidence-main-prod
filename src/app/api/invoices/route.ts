import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { listInvoices, saveInvoiceWithPaymentLink } from "@/lib/db/invoices";
import { invoiceFormSchema } from "@/lib/invoice/schema";

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

  const requirements = invoiceSaveRequirements(session);
  if ("error" in requirements) {
    return NextResponse.json(requirements, { status: 400 });
  }

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
    });

    return NextResponse.json(invoice);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save invoice",
      },
      { status: 400 },
    );
  }
}
