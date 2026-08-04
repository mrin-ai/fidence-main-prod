import { NextResponse } from "next/server";

import { fetchTokenPricesUsd } from "@/lib/coingecko/fetch-prices";
import { getSupportedPaymentTokens } from "@/lib/create-payment-link-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  const tokenIds = idsParam
    ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : getSupportedPaymentTokens().map((token) => token.id);

  try {
    const snapshot = await fetchTokenPricesUsd(tokenIds);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch token prices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
