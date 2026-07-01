import { NextResponse } from "next/server";

import { getSessionFromCookies } from "@/lib/db/auth";
import { getNextInvoiceSerial } from "@/lib/db/invoices";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serialNumber = await getNextInvoiceSerial(session.workspace._id);
  return NextResponse.json({ serialNumber, prefix: "INV-" });
}
