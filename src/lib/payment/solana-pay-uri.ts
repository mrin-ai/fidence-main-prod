import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { getSolanaTokenMint } from "@/lib/payment/solana-contracts";

export function buildSolanaPayUri(input: {
  recipientAddress: string;
  tokenId: string;
  amount?: number;
}) {
  const base = `solana:${input.recipientAddress}`;

  if (input.amount == null || input.amount <= 0) {
    return base;
  }

  if (input.tokenId === "sol") {
    const lamports = Math.round(input.amount * LAMPORTS_PER_SOL);
    return `${base}?amount=${lamports}`;
  }

  const token = getSolanaTokenMint(input.tokenId);
  if (!token) {
    throw new Error(`Token ${input.tokenId} not configured for Solana`);
  }

  const atomicAmount = Math.round(input.amount * 10 ** token.decimals);
  return `${base}?amount=${atomicAmount}&spl-token=${token.mint}`;
}
