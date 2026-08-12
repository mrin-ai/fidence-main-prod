import { NextResponse } from "next/server";

import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { getInvoiceById } from "@/lib/db/invoices";
import { enforceMerchantApiRateLimit } from "@/lib/merchant-api/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceMerchantApiRateLimit(getWorkspaceId(context));
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const invoice = await getInvoiceById(context.workspace._id, id);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      status: invoice.status,
      reference: invoice.reference,
      paymentLink: invoice.paymentLink,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    },
  });
}
