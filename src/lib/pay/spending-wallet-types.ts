export type PendingSpendingWallet = {
  networkId: string;
  address: string;
  sealedSecret: string;
  nonce: string;
  ephemeralPublicKey: string;
};

export const MAX_SPENDING_WALLETS_PER_CONNECT = 8;
export const MAX_SEALED_SECRET_LENGTH = 4096;
