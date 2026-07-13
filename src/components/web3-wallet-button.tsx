"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { Loader2 } from "lucide-react";
import { buildSignInMessage } from "@/lib/auth-session";
import { getClientReferralCode } from "@/components/referrals/referral-capture";

export function Web3WalletButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const referralCode = getClientReferralCode(searchParams);

  const { openConnectModal } = useConnectModal();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [loading, setLoading] = useState(false);
  const pendingConnect = useRef(false);

  const verifyWallet = useCallback(
    async (walletAddress: string) => {
      setLoading(true);
      try {
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
          throw new Error("Wallet sign-in failed");
        }

        router.push(redirect);
        router.refresh();
      } catch {
        pendingConnect.current = false;
      } finally {
        setLoading(false);
      }
    },
    [redirect, referralCode, router, signMessageAsync],
  );

  useEffect(() => {
    if (pendingConnect.current && isConnected && address) {
      pendingConnect.current = false;
      verifyWallet(address);
    }
  }, [address, isConnected, verifyWallet]);

  const handleClick = () => {
    if (loading) return;

    if (isConnected && address) {
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
    <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
      Sign-in uses your wallet&apos;s{" "}
      <span className="font-medium text-foreground/80">Ethereum (EVM)</span>{" "}
      address — even in Phantom. Solana is added separately under Wallets after
      you sign in.
    </p>
  </>
  );
}
