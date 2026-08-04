"use client";

import * as React from "react";

type TokenPriceSnapshot = {
  prices: Record<string, number>;
  asOf: string;
};

const REFRESH_MS = 60_000;

export function useTokenPrices(tokenIds: string[]) {
  const [snapshot, setSnapshot] = React.useState<TokenPriceSnapshot | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const idsKey = React.useMemo(
    () =>
      [...new Set(tokenIds.map((id) => id.trim().toLowerCase()).filter(Boolean))]
        .sort()
        .join(","),
    [tokenIds],
  );

  const refresh = React.useCallback(async () => {
    if (!idsKey) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/token-prices?ids=${encodeURIComponent(idsKey)}`);
      const payload = (await response.json()) as TokenPriceSnapshot & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load prices");
      }

      setSnapshot({
        prices: payload.prices ?? {},
        asOf: payload.asOf ?? new Date().toISOString(),
      });
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load prices",
      );
    } finally {
      setLoading(false);
    }
  }, [idsKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (!idsKey) return undefined;

    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [idsKey, refresh]);

  const getPrice = React.useCallback(
    (tokenId: string) => {
      const normalized = tokenId.trim().toLowerCase();
      return snapshot?.prices[normalized] ?? null;
    },
    [snapshot?.prices],
  );

  return {
    prices: snapshot?.prices ?? {},
    asOf: snapshot?.asOf ?? null,
    loading,
    error,
    getPrice,
    refresh,
  };
}
