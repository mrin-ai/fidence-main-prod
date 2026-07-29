"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { buildWalletVerifyMessage } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import type { WalletNetworkId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function VerifySolanaWalletButton({
  networkId,
  label,
  onVerified,
  disabled,
  className,
  connectLabel = "Connect Phantom",
  verifyLabel = "Sign to verify",
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
  connectLabel?: string;
  verifyLabel?: string;
}) {
  const {
    publicKey,
    connected,
    connecting,
    signMessage,
    wallets,
    select,
    connect,
    wallet,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const pendingConnectRef = useRef(false);

  const address = publicKey?.toBase58();

  useEffect(() => {
    if (!pendingConnectRef.current || !wallet || connected || connecting) {
      return;
    }

    pendingConnectRef.current = false;
    void connect().catch((error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not connect Phantom. Try again.",
      );
    });
  }, [wallet, connected, connecting, connect]);

  const connectPhantom = useCallback(() => {
    const phantom = wallets.find(
      (entry) => entry.adapter.name.toLowerCase() === "phantom",
    );

    if (!phantom) {
      toast.error("Phantom wallet not found. Install Phantom and try again.");
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }

    if (
      phantom.readyState !== WalletReadyState.Installed &&
      phantom.readyState !== WalletReadyState.Loadable
    ) {
      toast.error("Open or install the Phantom extension, then try again.");
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }

    // Only attaches a Solana receiving wallet — does not change login session.
    if (wallet?.adapter.name === phantom.adapter.name) {
      void connect().catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not connect Phantom. Try again.",
        );
      });
      return;
    }

    pendingConnectRef.current = true;
    select(phantom.adapter.name as WalletName);
  }, [wallets, wallet, connect, select]);

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
        toast.success("Solana wallet verified");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Verification failed";
      const rejected =
        /user rejected|rejected the request|cancelled|canceled/i.test(message);

      if (rejected) {
        toast.message("Signature cancelled in Phantom. Try again when ready.");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [label, networkId, onVerified, publicKey, signMessage]);

  if (!connected || !address) {
    return (
      <Button
        type="button"
        className={cn("h-9", className)}
        onClick={() => {
          try {
            connectPhantom();
          } catch {
            // Fallback if adapter select fails for any reason.
            setVisible(true);
          }
        }}
        disabled={disabled || connecting}
      >
        {connecting ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          connectLabel
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className={cn("h-9", className)}
      disabled={disabled || loading}
      onClick={() => void verifyWallet()}
    >
      {loading ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          Verifying…
        </>
      ) : (
        verifyLabel
      )}
    </Button>
  );
}
