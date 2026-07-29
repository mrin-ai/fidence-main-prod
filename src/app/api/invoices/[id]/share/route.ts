import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromCookies } from "@/lib/db/auth";
import { shareInvoiceByEmail } from "@/lib/db/invoices";

type RouteContext = { params: Promise<{ id: string }> };

const shareSchema = z.object({
  to: z.string().email("Enter a valid email address"),
  message: z.string().max(1000).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid share payload",
      },
      { status: 400 },
    );
  }

  try {
    const result = await shareInvoiceByEmail({
      workspaceId: session.workspace._id,
      userId: session.user._id,
      invoiceId: id,
      to: parsed.data.to,
      message: parsed.data.message,
      replyTo: session.user.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to share invoice";
    const status =
      message === "Invoice not found"
        ? 404
        : message.includes("RESEND_")
          ? 503
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
