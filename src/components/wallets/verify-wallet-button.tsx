"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { buildWalletVerifyMessage, normalizeEvmWalletAddress } from "@/lib/auth-session";
import {
  createPaymentWalletClient,
  getEthereumProvider,
  hasMetaMaskProvider,
  switchWalletChainForNetwork,
} from "@/lib/evm-switch-chain";
import { getChainIdForNetwork } from "@/lib/payment-contracts";
import { getWalletNetworkById } from "@/lib/wallet-networks";
import { Button } from "@/components/ui/button";
import type { WalletNetworkId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

function isMetaMaskConnector(connector: { id: string; name: string }) {
  const id = connector.id.toLowerCase();
  const name = connector.name.toLowerCase();
  if (id.includes("phantom") || name.includes("phantom")) return false;
  return id.includes("metamask") || name.includes("metamask");
}

function isPhantomConnector(connector: { id: string; name: string } | undefined) {
  if (!connector) return false;
  const id = connector.id.toLowerCase();
  const name = connector.name.toLowerCase();
  return id.includes("phantom") || name.includes("phantom");
}

export function VerifyWalletButton({
  networkId,
  address,
  label,
  onVerified,
  disabled,
  className,
  connectLabel = "Connect MetaMask",
  verifyLabel = "Sign to verify",
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
  connectLabel?: string;
  verifyLabel?: string;
}) {
  const { address: connectedAddress, isConnected, connector } = useAccount();
  const connectors = useConnectors();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const [loading, setLoading] = useState(false);

  const metaMaskConnector = useMemo(
    () => connectors.find(isMetaMaskConnector),
    [connectors],
  );

  const usingPhantom = isPhantomConnector(connector);
  const hasEvmSession = isConnected && !usingPhantom;
  const walletAddress = address || (hasEvmSession ? connectedAddress : undefined);

  const connectMetaMask = useCallback(async () => {
    if (!hasMetaMaskProvider() && !metaMaskConnector) {
      toast.error("MetaMask not found. Install MetaMask for EVM networks.");
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
      return;
    }

    try {
      if (metaMaskConnector) {
        await connectAsync({ connector: metaMaskConnector });
        return;
      }

      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error("MetaMask not found");
      }
      await provider.request({ method: "eth_requestAccounts" });
      toast.success("MetaMask connected");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not connect MetaMask. Try again.",
      );
    }
  }, [connectAsync, metaMaskConnector]);

  const verifyWallet = useCallback(async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      toast.error(
        "MetaMask not found. Use MetaMask for Ethereum / Base / Sepolia. Phantom is only for Solana.",
      );
      return;
    }

    const requiredChainId = getChainIdForNetwork(networkId);
    if (requiredChainId == null) {
      toast.error("Unsupported network");
      return;
    }

    setLoading(true);
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const activeAddress = accounts[0] || walletAddress;
      if (!activeAddress) {
        throw new Error("No MetaMask account available");
      }

      const normalizedAddress = normalizeEvmWalletAddress(
        activeAddress,
      ) as `0x${string}`;
      const networkLabel = getWalletNetworkById(networkId)?.label ?? networkId;

      toast.message(`Switching MetaMask to ${networkLabel}…`);
      await switchWalletChainForNetwork(networkId);

      const timestamp = Date.now();
      const message = buildWalletVerifyMessage(
        normalizedAddress,
        networkId,
        timestamp,
      );

      const walletClient = createPaymentWalletClient({
        account: normalizedAddress,
        chainId: requiredChainId,
      });
      const signature = await walletClient.signMessage({
        account: normalizedAddress,
        message,
      });

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
  }, [label, networkId, onVerified, walletAddress]);

  if (!walletAddress) {
    return (
      <Button
        type="button"
        className={cn("h-9", className)}
        onClick={() => void connectMetaMask()}
        disabled={disabled || isConnecting}
      >
        {isConnecting ? (
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
