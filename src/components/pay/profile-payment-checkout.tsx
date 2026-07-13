"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  CheckCircle2Icon,
  CopyIcon,
  Loader2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { PublicProfile } from "@/lib/db/public-profile";
import {
  getNetworkById,
  getTokenById,
  paymentTokens,
} from "@/lib/create-payment-link-data";
import { buildErc681Uri } from "@/lib/payment/erc681";
import { buildSolanaPayUri } from "@/lib/payment/solana-pay-uri";
import { buildProfileUrl, truncateAddress } from "@/lib/profile-url";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { PayPageNavbar } from "@/components/pay/pay-page-navbar";
import { useOnchainPayment } from "@/components/pay/use-onchain-payment";
import { useSolanaPayment } from "@/components/pay/use-solana-payment";
import { PaymentQrCode } from "@/components/payment/payment-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PROFILE_NETWORK_PILL_LIMIT = 4;

export function ProfilePaymentCheckout({
  profile,
}: {
  profile: PublicProfile;
}) {
  const [selectedNetworkId, setSelectedNetworkId] = useState(
    profile.wallets[0]?.networkId ?? "",
  );
  const [tokenId, setTokenId] = useState("usdc");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidTxHash, setPaidTxHash] = useState<string | null>(null);

  const { openConnectModal } = useConnectModal();
  const evmPayment = useOnchainPayment();
  const solanaPayment = useSolanaPayment();

  const isSolana = selectedNetworkId === "solana";
  const address = isSolana ? solanaPayment.address : evmPayment.address;
  const isConnected = isSolana ? solanaPayment.isConnected : evmPayment.isConnected;
  const isPaying = isSolana ? solanaPayment.isPaying : evmPayment.isPaying;

  const selectedWallet = profile.wallets.find(
    (wallet) => wallet.networkId === selectedNetworkId,
  );
  const network = getNetworkById(selectedNetworkId);
  const token = getTokenById(tokenId);
  const parsedAmount = Number(amount);
  const canPay =
    Boolean(selectedWallet) &&
    parsedAmount > 0 &&
    supportsOnChainPayment(selectedNetworkId, tokenId);

  const requiredChainId = isSolana
    ? null
    : evmPayment.getRequiredChainId(selectedNetworkId);
  const isWrongNetwork =
    !isSolana &&
    isConnected &&
    requiredChainId != null &&
    evmPayment.chainId !== requiredChainId;

  const availableTokens = useMemo(
    () =>
      paymentTokens.filter((entry) =>
        network?.tokenIds.includes(entry.id),
      ),
    [network],
  );

  useEffect(() => {
    if (!availableTokens.some((entry) => entry.id === tokenId)) {
      setTokenId(availableTokens[0]?.id ?? "usdc");
    }
  }, [availableTokens, tokenId]);

  const qrValue = useMemo(() => {
    if (!selectedWallet || !canPay) return null;
    try {
      if (selectedNetworkId === "solana") {
        return buildSolanaPayUri({
          recipientAddress: selectedWallet.address,
          tokenId,
          amount: parsedAmount,
        });
      }

      return buildErc681Uri({
        networkId: selectedNetworkId,
        tokenId,
        recipientAddress: selectedWallet.address,
        amount: parsedAmount,
      });
    } catch {
      return null;
    }
  }, [selectedWallet, canPay, selectedNetworkId, tokenId, parsedAmount]);

  const profileUrl = buildProfileUrl(profile.username);

  async function copyText(value: string, message = "Copied") {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  }

  async function handlePay() {
    if (!selectedWallet || !canPay || !address) return;

    try {
      const paymentInput = {
        recipientAddress: selectedWallet.address,
        amount: parsedAmount,
        tokenId,
        networkId: selectedNetworkId,
      };

      const { txHash, payerAddress } = isSolana
        ? await solanaPayment.executePayment(paymentInput)
        : await evmPayment.executePayment(paymentInput);

      const response = await fetch(`/api/public/users/${profile.username}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          tokenId,
          networkId: selectedNetworkId,
          payerAddress,
          txHash,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to record payment");
      }

      setPaid(true);
      setPaidTxHash(txHash);
      toast.success("Payment recorded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment failed");
    }
  }

  return (
    <div className="lcx-auth flex min-h-full flex-col bg-background">
      <PayPageNavbar />

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-10">
        <Card className="border-border/50 shadow-none">
          <CardContent className="space-y-8 px-6 py-8">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold tracking-tight">
                {profile.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {profile.company ? (
                <p className="text-xs text-muted-foreground/80">{profile.company}</p>
              ) : null}
            </div>

            {paid ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2Icon className="size-8 text-emerald-600" />
                <p className="text-sm font-medium">Payment sent</p>
                <p className="text-xs text-muted-foreground">
                  {parsedAmount} {token?.symbol ?? tokenId.toUpperCase()}
                  {paidTxHash ? ` · ${paidTxHash.slice(0, 10)}…` : ""}
                </p>
              </div>
            ) : profile.wallets.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No payment wallets configured yet.
              </p>
            ) : (
              <>
                {profile.wallets.length > PROFILE_NETWORK_PILL_LIMIT ? (
                  <div className="flex justify-center">
                    <Select
                      value={selectedNetworkId}
                      onValueChange={(value) => {
                        if (!value) return;
                        setSelectedNetworkId(value);
                      }}
                      items={profile.wallets.map((wallet) => ({
                        label: wallet.networkLabel,
                        value: wallet.networkId,
                      }))}
                    >
                      <SelectTrigger className="h-9 w-full max-w-[260px] rounded-full border-border/60 bg-muted/40 font-medium shadow-none">
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent align="center">
                        <SelectGroup>
                          {profile.wallets.map((wallet) => (
                            <SelectItem
                              key={wallet.networkId}
                              value={wallet.networkId}
                            >
                              {wallet.networkLabel}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-max min-w-full justify-center gap-1.5">
                      {profile.wallets.map((wallet) => {
                        const isSelected = wallet.networkId === selectedNetworkId;
                        return (
                          <button
                            key={wallet.networkId}
                            type="button"
                            onClick={() => setSelectedNetworkId(wallet.networkId)}
                            className={cn(
                              "shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                              isSelected
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                          >
                            {wallet.networkLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    id="profile-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                    className="w-full border-0 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />

                  {availableTokens.length > 1 ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      {availableTokens.map((entry) => {
                        const isSelected = entry.id === tokenId;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setTokenId(entry.id)}
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {entry.symbol}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-sm font-medium text-muted-foreground">
                      {token?.symbol ?? tokenId.toUpperCase()}
                    </p>
                  )}

                  {selectedWallet ? (
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(selectedWallet.address, "Address copied")
                      }
                      className="mx-auto flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                    >
                      <span className="font-mono">
                        {truncateAddress(selectedWallet.address, 6)}
                      </span>
                      <CopyIcon className="size-3" />
                    </button>
                  ) : null}
                </div>

                {qrValue ? (
                  <div className="flex justify-center py-1">
                    <div className="rounded-2xl border border-border/40 p-3">
                      <PaymentQrCode value={qrValue} size={128} minimal />
                    </div>
                  </div>
                ) : null}

                {!isConnected ? (
                  <Button
                    type="button"
                    className="h-10 w-full rounded-xl"
                    onClick={() =>
                      isSolana
                        ? solanaPayment.openWalletModal()
                        : openConnectModal?.()
                    }
                  >
                    <WalletIcon className="size-4" />
                    {isSolana ? "Connect Phantom" : "Connect wallet"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {isWrongNetwork ? (
                      <p className="text-center text-xs text-amber-700">
                        Switch to {network?.label} to pay
                      </p>
                    ) : (
                      <p className="text-center font-mono text-[11px] text-muted-foreground/70">
                        {address?.slice(0, 6)}…{address?.slice(-4)}
                      </p>
                    )}
                    <Button
                      className="h-10 w-full rounded-xl"
                      disabled={!canPay || isPaying}
                      onClick={() => void handlePay()}
                    >
                      {isPaying ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <WalletIcon className="size-4" />
                          {parsedAmount > 0 && token?.symbol
                            ? `Pay ${parsedAmount} ${token.symbol}`
                            : "Enter amount"}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => void copyText(profileUrl, "Profile link copied")}
          className="mx-auto mt-5 flex max-w-full items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        >
          <span className="truncate font-mono">{profileUrl}</span>
          <CopyIcon className="size-3 shrink-0" />
        </button>

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          powered by{" "}
          <Link
            href="/"
            className="font-semibold text-primary hover:underline"
          >
            PayAgent
          </Link>
        </p>
      </div>
    </div>
  );
}
