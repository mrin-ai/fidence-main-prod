export type CoingeckoApiTier = "demo" | "pro";

export type CoingeckoClientConfig = {
  baseUrl: string;
  headerName: "x-cg-demo-api-key" | "x-cg-pro-api-key" | null;
  apiKey: string | null;
  tier: CoingeckoApiTier | "public";
};

export function getCoingeckoClientConfig(): CoingeckoClientConfig {
  const apiKey = process.env.COINGECKO_API_KEY?.trim() || null;
  const tierEnv = process.env.COINGECKO_API_TIER?.trim().toLowerCase();

  if (!apiKey) {
    return {
      baseUrl: "https://api.coingecko.com/api/v3",
      headerName: null,
      apiKey: null,
      tier: "public",
    };
  }

  const tier: CoingeckoApiTier =
    tierEnv === "pro" || tierEnv === "paid" ? "pro" : "demo";

  if (tier === "pro") {
    return {
      baseUrl: "https://pro-api.coingecko.com/api/v3",
      headerName: "x-cg-pro-api-key",
      apiKey,
      tier,
    };
  }

  return {
    baseUrl: "https://api.coingecko.com/api/v3",
    headerName: "x-cg-demo-api-key",
    apiKey,
    tier,
  };
}
