"use client";

import { useCallback, useEffect, useRef } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";

import { useOnchainPayment } from "@/components/pay/use-onchain-payment";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { truncateAddress } from "@/lib/profile-url";
import { supportsOnChainPayment } from "@/lib/payment-contracts";

type AutoExecuteIntent = {
  intentId: string;
  externalAgentId: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
  recipientAddress?: string | null;
};

function formatToken(tokenId?: string) {
  if (!tokenId) return "";
  return tokenId.toUpperCase();
}

export function AutoPayProcessor() {
  const processingRef = useRef<string | null>(null);
  const connectPromptedRef = useRef(false);

  const { openConnectModal } = useConnectModal();
  const { executePayment, isConnected, isPaying } = useOnchainPayment();

  const executeIntent = useCallback(
    async (intent: AutoExecuteIntent) => {
      if (
        !intent.networkId ||
        !intent.tokenId ||
        intent.amount == null ||
        !intent.recipientAddress ||
        !supportsOnChainPayment(intent.networkId, intent.tokenId)
      ) {
        return;
      }

      if (intent.networkId === "solana") {
        toast.error("Solana auto-pay is not supported in the portal yet.");
        return;
      }

      if (!isConnected) {
        if (!connectPromptedRef.current) {
          connectPromptedRef.current = true;
          toast.message("Connect your wallet to complete agent auto-payment.");
          openConnectModal?.();
        }
        return;
      }

      connectPromptedRef.current = false;
      processingRef.current = intent.intentId;

      const amountLabel = `${intent.amount} ${formatToken(intent.tokenId)}`;
      const recipientLabel = truncateAddress(intent.recipientAddress, 6);

      try {
        toast.message(`Agent payment: ${amountLabel} to ${recipientLabel}…`);

        const { txHash, payerAddress } = await executePayment({
          recipientAddress: intent.recipientAddress,
          amount: intent.amount,
          tokenId: intent.tokenId,
          networkId: intent.networkId,
        });

        const completeRes = await fetch(
          `/api/pay/payment-intents/${intent.intentId}/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payerAddress, txHash }),
          },
        );
        const completeData = (await completeRes.json()) as { error?: string };

        if (!completeRes.ok) {
          throw new Error(
            completeData.error ??
              "Payment was sent but could not be recorded. Save your transaction hash.",
          );
        }

        const explorerUrl = getTxExplorerUrl(intent.networkId, txHash);
        toast.success(`Agent payment sent · ${amountLabel}`, {
          action: explorerUrl
            ? {
                label: "View tx",
                onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer"),
              }
            : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Auto-payment failed";
        toast.error(message);
      } finally {
        processingRef.current = null;
      }
    },
    [executePayment, isConnected, openConnectModal],
  );

  const poll = useCallback(async () => {
    if (processingRef.current || isPaying) return;

    try {
      const res = await fetch("/api/pay/payment-intents?status=auto_execute");
      if (!res.ok) return;

      const data = (await res.json()) as { intents?: AutoExecuteIntent[] };
      const intent = data.intents?.[0];
      if (!intent) return;

      await executeIntent(intent);
    } catch {
      // Ignore transient poll errors.
    }
  }, [executeIntent, isPaying]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(timer);
  }, [poll]);

  return null;
}
