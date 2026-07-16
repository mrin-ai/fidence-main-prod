"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { Loader2 } from "lucide-react";
import { buildSignInMessage } from "@/lib/auth-session";
import { getClientReferralCode } from "@/components/referrals/referral-capture";

const CHAIN_MISMATCH_MESSAGE =
  "Your wallet network changed since the last connection. Connect your wallet again to sign in.";

function isConnectorChainMismatch(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("does not match the connection's chain");
}

async function connectorMatchesConnection(
  connector: { getChainId: () => Promise<number> } | undefined,
  connectionChainId: number | undefined,
) {
  if (!connector || connectionChainId == null) return true;

  try {
    const connectorChainId = await connector.getChainId();
    return connectorChainId === connectionChainId;
  } catch {
    return false;
  }
}

export function Web3WalletButton() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const referralCode = getClientReferralCode(searchParams);

  const { openConnectModal } = useConnectModal();
  const { address, chainId, connector, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingConnect = useRef(false);
  const clearedStaleSession = useRef(false);

  useEffect(() => {
    if (clearedStaleSession.current) return;
    clearedStaleSession.current = true;
    disconnect();
  }, [disconnect]);

  const resetWalletConnection = useCallback(() => {
    pendingConnect.current = false;
    disconnect();
  }, [disconnect]);

  const verifyWallet = useCallback(
    async (walletAddress: string) => {
      setLoading(true);
      setError(null);
      try {
        const inSync = await connectorMatchesConnection(connector, chainId);
        if (!inSync) {
          resetWalletConnection();
          setError(CHAIN_MISMATCH_MESSAGE);
          return;
        }

        const timestamp = Date.now();
        const message = buildSignInMessage(walletAddress, timestamp);
        const signature = await signMessageAsync({ message });

        const response = await fetch("/api/auth/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          message,
          signature,
          ...(referralCode ? { referralCode } : {}),
        }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Wallet sign-in failed");
        }

        window.location.assign(redirect);
        return;
      } catch (walletError) {
        pendingConnect.current = false;
        if (isConnectorChainMismatch(walletError)) {
          resetWalletConnection();
          setError(CHAIN_MISMATCH_MESSAGE);
          return;
        }
        setError(
          walletError instanceof Error
            ? walletError.message
            : "Wallet sign-in failed",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      chainId,
      connector,
      redirect,
      referralCode,
      resetWalletConnection,
      signMessageAsync,
    ],
  );

  useEffect(() => {
    if (pendingConnect.current && isConnected && address) {
      pendingConnect.current = false;
      verifyWallet(address);
    }
  }, [address, isConnected, verifyWallet]);

  const handleClick = async () => {
    if (loading) return;
    setError(null);

    if (isConnected && address) {
      const inSync = await connectorMatchesConnection(connector, chainId);
      if (!inSync) {
        resetWalletConnection();
        setError(CHAIN_MISMATCH_MESSAGE);
        return;
      }

      verifyWallet(address);
      return;
    }

    pendingConnect.current = true;
    openConnectModal?.();
  };

  return (
    <>
    <button
      type="button"
      className="group relative mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-background text-sm transition-all duration-200 hover:border-foreground/15 hover:bg-muted/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={loading}
      onClick={handleClick}
    >
      <div className="flex h-5 w-5 items-center justify-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Image
            src="/wallet-icon.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
        )}
      </div>
      <span className="font-medium text-foreground/80 transition-colors group-hover:text-foreground">
        Web3 wallet
      </span>
    </button>
    {error ? (
      <p className="mt-2 text-center text-sm text-destructive">{error}</p>
    ) : null}
    <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
      Sign-in uses your wallet&apos;s{" "}
      <span className="font-medium text-foreground/80">Ethereum (EVM)</span>{" "}
      address — even in Phantom. Solana is added separately under Wallets after
      you sign in.
    </p>
  </>
  );
}
