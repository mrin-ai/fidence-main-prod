import { NextResponse } from "next/server";

import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { saveInvoiceWithPaymentLink } from "@/lib/db/invoices";
import { requireRecipientAddress } from "@/lib/db/wallets";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";
import { invoiceFormSchema } from "@/lib/invoice/schema";

export async function POST(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = invoiceFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid invoice payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!context.owner.username) {
    return NextResponse.json(
      {
        error: "Set a username in Settings before creating invoices with payment links",
        code: "USERNAME_REQUIRED",
      },
      { status: 400 },
    );
  }

  const recipient = requireRecipientAddress(
    context.owner,
    parsed.data.paymentLink.networkId,
  );
  if (!recipient.ok) {
    return NextResponse.json(
      { error: recipient.error, code: recipient.code },
      { status: 400 },
    );
  }

  try {
    const invoice = await saveInvoiceWithPaymentLink({
      workspaceId: context.workspace._id,
      userId: context.owner._id,
      username: context.owner.username,
      recipientAddress: recipient.recipientAddress,
      data: parsed.data,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create invoice",
      },
      { status: 400 },
    );
  }
}
