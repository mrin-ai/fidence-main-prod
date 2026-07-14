"use client";

import { useCallback, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { Loader2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { getWalletNetworkById } from "@/lib/wallet-networks";
import { buildWalletVerifyMessage, normalizeEvmWalletAddress } from "@/lib/auth-session";
import { getChainIdForNetwork } from "@/lib/payment-contracts";
import { switchWalletChain } from "@/lib/evm-switch-chain";
import { Button } from "@/components/ui/button";
import type { WalletNetworkId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function VerifyWalletButton({
  networkId,
  address,
  label,
  onVerified,
  disabled,
  className,
}: {
  networkId: WalletNetworkId;
  address: string;
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
  const { openConnectModal } = useConnectModal();
  const { address: connectedAddress, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(false);

  const network = getWalletNetworkById(networkId);
  const requiredChainId = getChainIdForNetwork(networkId);
  const needsNetworkSwitch =
    isConnected &&
    requiredChainId != null &&
    chainId != null &&
    chainId !== requiredChainId;

  const verifyWallet = useCallback(async () => {
    const walletAddress = address || connectedAddress;
    if (!walletAddress) return;

    const normalizedAddress = normalizeEvmWalletAddress(
      walletAddress,
    ) as `0x${string}`;

    setLoading(true);
    try {
      if (needsNetworkSwitch && requiredChainId != null) {
        try {
          await switchWalletChain(requiredChainId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Network switch failed";
          if (message.includes("cancelled")) {
            toast.message(
              `Still on ${network?.label ?? networkId}? Check the message says Network: ${networkId} before confirming.`,
            );
          } else {
            throw error;
          }
        }
      }

      const timestamp = Date.now();
      const message = buildWalletVerifyMessage(
        normalizedAddress,
        networkId,
        timestamp,
      );
      const signature = await signMessageAsync({ message });

      const response = await fetch("/api/wallets/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: normalizedAddress,
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
  }, [
    address,
    connectedAddress,
    label,
    needsNetworkSwitch,
    network?.label,
    networkId,
    onVerified,
    requiredChainId,
    signMessageAsync,
  ]);

  if (!isConnected && !address) {
    return (
      <Button
        type="button"
        className={cn("h-10 w-full", className)}
        onClick={() => openConnectModal?.()}
        disabled={disabled}
      >
        <WalletIcon className="size-4" />
        Connect wallet
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
          {needsNetworkSwitch ? "Switching network…" : "Verifying…"}
        </>
      ) : (
        <>
          <WalletIcon className="size-4" />
          {needsNetworkSwitch
            ? `Switch to ${network?.label ?? networkId} & sign`
            : `Sign to verify ${network?.label ?? networkId}`}
        </>
      )}
    </Button>
  );
}
