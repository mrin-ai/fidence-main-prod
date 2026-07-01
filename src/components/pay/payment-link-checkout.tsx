"use client";

import { useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  CheckCircle2Icon,
  Clock3Icon,
  Loader2Icon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react";
import { parseEther, parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";

import type { PublicPaymentLink } from "@/lib/payment-link-types";
import { PayPageNavbar } from "@/components/pay/pay-page-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  erc20TransferAbi,
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "@/lib/payment-contracts";
import { cn } from "@/lib/utils";

function StatusBanner({ link }: { link: PublicPaymentLink }) {
  if (link.status === "paid") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-900">Payment completed</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {link.amount} {link.tokenSymbol} was paid
            {link.paidAtLabel ? ` on ${link.paidAtLabel}` : ""}
            .
          </p>
        </div>
      </div>
    );
  }

  if (link.status === "expired") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-medium text-red-900">Link expired</p>
          <p className="mt-0.5 text-xs text-red-700">
            This payment link is no longer accepting payments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <Clock3Icon className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-medium text-amber-900">Pending payment</p>
        <p className="mt-0.5 text-xs text-amber-700">
          Expires {link.expiresAtLabel}
        </p>
      </div>
    </div>
  );
}

export function PaymentLinkCheckout({
  initialLink,
}: {
  initialLink: PublicPaymentLink;
}) {
  const [link, setLink] = useState(initialLink);
  const [isPaying, setIsPaying] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const requiredChainId = getChainIdForNetwork(link.networkId);
  const isWrongNetwork =
    isConnected && requiredChainId != null && chainId !== requiredChainId;

  async function recordPayment(txHash: string) {
    const response = await fetch(
      `/api/pay/${link.username}/${link.publicId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerAddress: address,
          txHash,
        }),
      },
    );

    const data = (await response.json()) as PublicPaymentLink & { error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to confirm payment");
    }

    setLink(data);
    toast.success("Payment recorded successfully");
  }

  async function handlePay() {
    if (!address || !link.recipientAddress) return;

    if (!supportsOnChainPayment(link.networkId, link.tokenId)) {
      toast.error("This token/network combination is not supported yet");
      return;
    }

    if (requiredChainId == null) {
      toast.error("Unsupported network");
      return;
    }

    setIsPaying(true);

    try {
      if (chainId !== requiredChainId) {
        await switchChainAsync({ chainId: requiredChainId });
      }

      let txHash: `0x${string}`;

      if (link.tokenId === "eth") {
        txHash = await sendTransactionAsync({
          to: link.recipientAddress as `0x${string}`,
          value: parseEther(link.amount.toString()),
        });
      } else {
        const token = getTokenContract(link.networkId, link.tokenId);
        if (!token) {
          throw new Error("Token contract not configured for this network");
        }

        txHash = await writeContractAsync({
          address: token.address,
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [
            link.recipientAddress as `0x${string}`,
            parseUnits(link.amount.toString(), token.decimals),
          ],
        });
      }

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      await recordPayment(txHash);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Payment failed. Try again.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  const showPayActions = link.status === "pending" && link.canPay;

  return (
    <div className="lcx-auth min-h-full bg-background">
      <PayPageNavbar />

      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8">
        <Card className="border-border/60 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Pay to
                </p>
                <CardTitle className="mt-1 text-lg">
                  {link.merchantName}
                </CardTitle>
                <p className="mt-0.5 font-mono text-xs text-primary">
                  @{link.username}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-lg capitalize",
                  link.status === "paid" && "bg-emerald-100 text-emerald-700",
                  link.status === "expired" && "bg-red-100 text-red-700",
                  link.status === "pending" && "bg-amber-100 text-amber-700",
                )}
              >
                {link.status}
              </Badge>
            </div>
            <StatusBanner link={link} />
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Amount due
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {link.amount}{" "}
                <span className="text-xl text-muted-foreground">
                  {link.tokenSymbol}
                </span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Network: {link.networkLabel}
              </p>
            </div>

            {link.status === "paid" ? (
              <div className="space-y-3 rounded-xl border border-border/60 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-medium tabular-nums">
                    {link.amount} {link.tokenSymbol}
                  </span>
                </div>
                {link.paidBy ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Paid by</span>
                      <span className="max-w-[12rem] truncate font-mono text-xs">
                        {link.paidBy}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {showPayActions ? (
              <div className="space-y-4">
                {!link.recipientAddress ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    This merchant has not configured a wallet to receive
                    payments yet.
                  </div>
                ) : !isConnected ? (
                  <Button
                    type="button"
                    className="h-10 w-full rounded-xl"
                    onClick={() => openConnectModal?.()}
                  >
                    <WalletIcon className="size-4" />
                    Connect wallet
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {isWrongNetwork ? (
                      <p className="text-center text-xs text-amber-700">
                        Your wallet is on the wrong network. Tap below to switch
                        to {link.networkLabel} and pay.
                      </p>
                    ) : (
                      <p className="text-center font-mono text-[11px] text-muted-foreground">
                        {address?.slice(0, 6)}…{address?.slice(-4)}
                      </p>
                    )}

                    <Button
                      className="h-10 w-full rounded-xl"
                      disabled={isPaying}
                      onClick={handlePay}
                    >
                      {isPaying ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Processing payment...
                        </>
                      ) : (
                        <>
                          <WalletIcon className="size-4" />
                          {isWrongNetwork
                            ? `Switch to ${link.networkLabel} & pay`
                            : `Pay ${link.amount} ${link.tokenSymbol}`}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {link.status === "pending" && !link.canPay && link.networkId === "solana" ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                Solana payments are not supported yet. Ask the merchant for an
                EVM network link.
              </div>
            ) : null}

            <p className="text-center text-[11px] text-muted-foreground">
              Link ID{" "}
              <span className="font-mono">{link.publicId}</span>
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Fidence
          </Link>
        </p>
      </div>
    </div>
  );
}
