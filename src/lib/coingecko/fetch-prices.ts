import { getCoingeckoClientConfig } from "@/lib/coingecko/config";
import {
  fromCoingeckoCoinId,
  normalizeTokenIds,
  toCoingeckoCoinId,
} from "@/lib/coingecko/token-map";

export type TokenPriceSnapshot = {
  prices: Record<string, number>;
  asOf: string;
};

const CACHE_TTL_MS = 60_000;

let cachedSnapshot: { key: string; expiresAt: number; snapshot: TokenPriceSnapshot } | null =
  null;

function buildCacheKey(coinIds: string[]) {
  return coinIds.slice().sort().join(",");
}

async function readCoingeckoError(response: Response) {
  try {
    const payload = (await response.json()) as { status?: { error_message?: string } };
    return payload.status?.error_message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function fetchTokenPricesUsd(
  tokenIds: string[],
): Promise<TokenPriceSnapshot> {
  const normalized = normalizeTokenIds(tokenIds);
  const coinIds = [
    ...new Set(
      normalized.map((tokenId) => toCoingeckoCoinId(tokenId)).filter(Boolean) as string[],
    ),
  ];

  if (coinIds.length === 0) {
    return { prices: {}, asOf: new Date().toISOString() };
  }

  const cacheKey = buildCacheKey(coinIds);
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.key === cacheKey && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.snapshot;
  }

  const client = getCoingeckoClientConfig();
  const url = new URL(`${client.baseUrl}/simple/price`);
  url.searchParams.set("ids", coinIds.join(","));
  url.searchParams.set("vs_currencies", "usd");

  const headers: HeadersInit = { Accept: "application/json" };
  if (client.apiKey && client.headerName) {
    headers[client.headerName] = client.apiKey;
  }

  const response = await fetch(url.toString(), {
    headers,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const detail = await readCoingeckoError(response);
    throw new Error(
      `CoinGecko price fetch failed (${response.status}): ${detail}`,
    );
  }

  const payload = (await response.json()) as Record<string, { usd?: number }>;
  const prices: Record<string, number> = {};

  for (const [coinId, quote] of Object.entries(payload)) {
    const tokenId = fromCoingeckoCoinId(coinId);
    const usd = quote?.usd;
    if (tokenId && typeof usd === "number" && Number.isFinite(usd) && usd > 0) {
      prices[tokenId] = usd;
    }
  }

  const snapshot: TokenPriceSnapshot = {
    prices,
    asOf: new Date().toISOString(),
  };

  cachedSnapshot = {
    key: cacheKey,
    expiresAt: now + CACHE_TTL_MS,
    snapshot,
  };

  return snapshot;
}
