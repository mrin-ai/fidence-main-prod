import { NextResponse } from "next/server";

import { getComplianceCatalog } from "@/lib/compliance/catalog";
import {
  getMerchantApiContext,
  merchantApiUnauthorized,
} from "@/lib/db/merchant-api";

export async function GET(request: Request) {
  const context = await getMerchantApiContext(request);
  if (!context) return merchantApiUnauthorized();

  return NextResponse.json(getComplianceCatalog());
}
