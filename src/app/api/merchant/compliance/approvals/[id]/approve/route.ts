import { NextResponse } from "next/server";

import { actorFromSecurity } from "@/lib/compliance/actor";
import { getSessionFromCookies } from "@/lib/db/auth";
import { resolvePaymentApproval } from "@/lib/db/payment-approvals";
import {
  canMutateCompliance,
  getWorkspaceMembership,
} from "@/lib/db/workspace-membership";
import { extractSecurityContext } from "@/lib/request-security";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getWorkspaceMembership(
    session.workspace._id,
    session.user._id,
  );
  if (!canMutateCompliance(membership?.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can approve payments" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const security = extractSecurityContext(request);
  const result = await resolvePaymentApproval({
    workspaceId: session.workspace._id,
    approvalId: id,
    decision: "approved",
    actor: actorFromSecurity(security, {
      actorType: "user",
      authMethod: "session",
      userId: session.user._id.toString(),
    }),
    security,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    approvalId: result.approval.approvalId,
    status: result.approval.status,
    receiptId: result.receiptId,
  });
}
