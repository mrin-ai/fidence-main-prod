"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { getSolanaTokenMint, supportsSolanaPayment } from "@/lib/payment/solana-contracts";

function formatSolanaError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Payment failed. Try again.";
  }

  const message = error.message;

  if (
    message.includes("User rejected") ||
    message.includes("user rejected") ||
    message.includes("rejected the request")
  ) {
    return "Transaction cancelled.";
  }

  if (message.includes("insufficient")) {
    return "Not enough balance in your wallet for this payment.";
  }

  return message.length > 180
    ? "Payment failed. Check wallet balance and try again."
    : message;
}

export type SolanaPaymentInput = {
  recipientAddress: string;
  amount: number;
  tokenId: string;
};

export function useSolanaPayment() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [isPaying, setIsPaying] = useState(false);

  const executePayment = useCallback(
    async (input: SolanaPaymentInput) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected");
      }

      if (!supportsSolanaPayment(input.tokenId)) {
        throw new Error("This token is not supported on Solana yet");
      }

      setIsPaying(true);

      try {
        const recipient = new PublicKey(input.recipientAddress);
        const transaction = new Transaction();

        if (input.tokenId === "sol") {
          const lamports = Math.round(input.amount * LAMPORTS_PER_SOL);
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: recipient,
              lamports,
            }),
          );
        } else {
          const token = getSolanaTokenMint(input.tokenId);
          if (!token) {
            throw new Error("Token not configured for Solana");
          }

          const mint = new PublicKey(token.mint);
          const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
          const destinationAta = getAssociatedTokenAddressSync(mint, recipient);
          const amountAtomic = BigInt(
            Math.round(input.amount * 10 ** token.decimals),
          );

          transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey,
              destinationAta,
              recipient,
              mint,
            ),
            createTransferCheckedInstruction(
              sourceAta,
              mint,
              destinationAta,
              publicKey,
              amountAtomic,
              token.decimals,
            ),
          );
        }

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signed = await signTransaction(transaction);
        const txHash = await connection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: false },
        );

        await connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight,
        });

        return { txHash, payerAddress: publicKey.toBase58() };
      } catch (error) {
        throw new Error(formatSolanaError(error));
      } finally {
        setIsPaying(false);
      }
    },
    [connection, publicKey, signTransaction],
  );

  return {
    address: publicKey?.toBase58(),
    isConnected: connected,
    isPaying,
    executePayment,
    openWalletModal: () => setVisible(true),
  };
}
