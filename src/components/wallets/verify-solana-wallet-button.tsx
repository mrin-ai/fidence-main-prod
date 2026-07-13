"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Loader2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { buildWalletVerifyMessage } from "@/lib/auth-session";
import { getWalletNetworkById } from "@/lib/wallet-networks";
import { Button } from "@/components/ui/button";
import type { WalletNetworkId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function VerifySolanaWalletButton({
  networkId,
  label,
  onVerified,
  disabled,
  className,
}: {
  networkId: WalletNetworkId;
  label?: string;
  onVerified: (wallet: {
    id: string;
    networkId: string;
    networkLabel: string;
    address: string;
    label?: string;
    verifiedAt: string;
  }) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [loading, setLoading] = useState(false);

  const network = getWalletNetworkById(networkId);
  const address = publicKey?.toBase58();

  const verifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    setLoading(true);
    try {
      const walletAddress = publicKey.toBase58();
      const timestamp = Date.now();
      const message = buildWalletVerifyMessage(
        walletAddress,
        networkId,
        timestamp,
      );
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          networkId,
          label,
          message,
          signature,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        wallet?: {
          id: string;
          networkId: string;
          networkLabel: string;
          address: string;
          label?: string;
          verifiedAt: string;
        };
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Verification failed");
      }

      if (data.wallet) {
        onVerified(data.wallet);
        toast.success("Wallet verified");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, [label, networkId, onVerified, publicKey, signMessage]);

  if (!connected || !address) {
    return (
      <Button
        type="button"
        className={cn("h-10 w-full", className)}
        onClick={() => setVisible(true)}
        disabled={disabled}
      >
        <WalletIcon className="size-4" />
        Connect Phantom
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className={cn("h-10 w-full", className)}
      disabled={disabled || loading}
      onClick={() => void verifyWallet()}
    >
      {loading ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Verifying…
        </>
      ) : (
        <>
          <WalletIcon className="size-4" />
          Sign to verify {network?.label ?? "Solana"}
        </>
      )}
    </Button>
  );
}
