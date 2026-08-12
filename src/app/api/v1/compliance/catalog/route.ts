import { NextResponse } from "next/server";

import { getComplianceCatalog } from "@/lib/compliance/catalog";
import {
  getMerchantApiContext,
  getWorkspaceId,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";
import { enforceComplianceReadRateLimit } from "@/lib/merchant-api/rate-limit";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  const rateLimited = await enforceComplianceReadRateLimit(
    getWorkspaceId(context),
  );
  if (rateLimited) return rateLimited;

  return NextResponse.json(getComplianceCatalog());
}
