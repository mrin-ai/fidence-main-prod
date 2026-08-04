"use client";

import * as React from "react";

import { getSupportedPaymentTokens } from "@/lib/create-payment-link-data";
import { useTokenPrices } from "@/hooks/use-token-prices";

type TokenPricesContextValue = {
  getPrice: (tokenId: string) => number | null;
  loading: boolean;
};

const TokenPricesContext = React.createContext<TokenPricesContextValue | null>(
  null,
);

export function TokenPricesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const tokenIds = React.useMemo(
    () => getSupportedPaymentTokens().map((token) => token.id),
    [],
  );
  const { getPrice, loading } = useTokenPrices(tokenIds);

  const value = React.useMemo(
    () => ({ getPrice, loading }),
    [getPrice, loading],
  );

  return (
    <TokenPricesContext.Provider value={value}>
      {children}
    </TokenPricesContext.Provider>
  );
}

export function useTokenPricesContext() {
  return React.useContext(TokenPricesContext);
}
