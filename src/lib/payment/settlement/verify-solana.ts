import { Connection, PublicKey } from "@solana/web3.js";

import { getSolanaRpcUrl } from "@/lib/solana-config";
import { getSolanaTokenMint } from "@/lib/payment/solana-contracts";

import { isFormatOnlySettlementVerification } from "./mode";
import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

const SOLANA_TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

function isValidSolanaSignatureFormat(txHash: string) {
  return SOLANA_TX_SIGNATURE_REGEX.test(txHash.trim());
}

type SolanaTransferMatch = {
  ok: true;
  observedAmount: number;
};

function normalizePayerAddress(payerAddress: string | undefined) {
  return payerAddress?.trim() ?? "";
}

function meetsMinimumAmount(actual: number, expected: number) {
  return actual >= expected * 0.99;
}

async function verifySolanaTransferDetailed(
  intent: SettlementIntent,
  txHash: string,
): Promise<SolanaTransferMatch | { ok: false }> {
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const transaction = await connection.getParsedTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction || transaction.meta?.err) {
    return { ok: false };
  }

  const recipient = new PublicKey(intent.recipientAddress);
  const expectedPayer = normalizePayerAddress(intent.payerAddress);
  const instructions = transaction.transaction.message.instructions;

  for (const instruction of instructions) {
    if (!("parsed" in instruction) || !instruction.parsed) continue;

    const parsed = instruction.parsed as {
      type?: string;
      info?: Record<string, unknown>;
    };

    if (intent.tokenId === "sol" && parsed.type === "transfer") {
      const source = parsed.info?.source;
      const destination = parsed.info?.destination;
      const lamports = parsed.info?.lamports;
      if (
        typeof source === "string" &&
        typeof destination === "string" &&
        destination === recipient.toBase58() &&
        typeof lamports === "number" &&
        meetsMinimumAmount(lamports / 1_000_000_000, intent.amount)
      ) {
        if (expectedPayer && source !== expectedPayer) continue;
        return { ok: true, observedAmount: lamports / 1_000_000_000 };
      }
    }

    if (parsed.type === "transferChecked" || parsed.type === "transfer") {
      const source = parsed.info?.source ?? parsed.info?.authority;
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
        meetsMinimumAmount(tokenAmount.uiAmount, intent.amount)
      ) {
        const destOwner = parsed.info?.authority ?? parsed.info?.source;
        const recipientMatch =
          destination === recipient.toBase58() ||
          (typeof destOwner === "string" && destOwner === recipient.toBase58());

        if (!recipientMatch) continue;

        if (expectedPayer && typeof source === "string" && source !== expectedPayer) {
          continue;
        }

        return { ok: true, observedAmount: tokenAmount.uiAmount };
      }
    }
  }

  return { ok: false };
}

export const solanaSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(intent: SettlementIntent, txHash: string) {
    const detailed = await this.verifySettlementDetailed(intent, txHash);
    return detailed.ok;
  },

  async verifySettlementDetailed(intent: SettlementIntent, txHash: string) {
    const signature = txHash.trim();
    if (!isValidSolanaSignatureFormat(signature)) {
      return { ok: false as const };
    }

    if (isFormatOnlySettlementVerification()) {
      return { ok: true as const, observedAmount: intent.amount };
    }

    try {
      const match = await verifySolanaTransferDetailed(intent, signature);
      return match.ok
        ? { ok: true as const, observedAmount: match.observedAmount }
        : { ok: false as const };
    } catch {
      return { ok: false as const };
    }
  },
};
