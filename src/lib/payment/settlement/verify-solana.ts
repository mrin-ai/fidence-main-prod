import { Connection, PublicKey } from "@solana/web3.js";

import { getSolanaRpcUrl } from "@/lib/solana-config";
import { getSolanaTokenMint } from "@/lib/payment/solana-contracts";
import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

const SOLANA_TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

function isValidSolanaSignatureFormat(txHash: string) {
  return SOLANA_TX_SIGNATURE_REGEX.test(txHash.trim());
}

async function verifySolanaTransfer(
  intent: SettlementIntent,
  txHash: string,
) {
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const transaction = await connection.getParsedTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction || transaction.meta?.err) {
    return false;
  }

  const recipient = new PublicKey(intent.recipientAddress);
  const instructions = transaction.transaction.message.instructions;

  for (const instruction of instructions) {
    if (!("parsed" in instruction) || !instruction.parsed) continue;

    const parsed = instruction.parsed as {
      type?: string;
      info?: Record<string, unknown>;
    };

    if (intent.tokenId === "sol" && parsed.type === "transfer") {
      const destination = parsed.info?.destination;
      const lamports = parsed.info?.lamports;
      if (
        typeof destination === "string" &&
        destination === recipient.toBase58() &&
        typeof lamports === "number" &&
        lamports >= Math.floor(intent.amount * 1_000_000_000) * 0.99
      ) {
        return true;
      }
    }

    if (parsed.type === "transferChecked" || parsed.type === "transfer") {
      const destination = parsed.info?.destination;
      const mint = parsed.info?.mint;
      const tokenAmount = parsed.info?.tokenAmount as
        | { uiAmount?: number; amount?: string; decimals?: number }
        | undefined;
      const token = getSolanaTokenMint(intent.tokenId);

      if (
        token &&
        typeof destination === "string" &&
        typeof mint === "string" &&
        mint === token.mint &&
        tokenAmount?.uiAmount != null &&
        tokenAmount.uiAmount >= intent.amount * 0.99
      ) {
        const destOwner = parsed.info?.authority ?? parsed.info?.source;
        if (destination === recipient.toBase58()) {
          return true;
        }
        if (typeof destOwner === "string" && destOwner === recipient.toBase58()) {
          return true;
        }
      }
    }
  }

  const accountKeys = transaction.transaction.message.accountKeys.map((key) =>
    typeof key === "string" ? key : key.pubkey.toBase58(),
  );

  return accountKeys.includes(recipient.toBase58());
}

export const solanaSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(intent: SettlementIntent, txHash: string) {
    const signature = txHash.trim();
    if (!isValidSolanaSignatureFormat(signature)) {
      return false;
    }

    const mode = process.env.PAYMENT_SETTLEMENT_VERIFY_MODE ?? "wagmi";
    if (mode === "wagmi") {
      return true;
    }

    try {
      return await verifySolanaTransfer(intent, signature);
    } catch {
      return false;
    }
  },
};
