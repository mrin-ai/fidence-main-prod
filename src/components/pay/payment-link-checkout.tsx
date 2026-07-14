"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { PublicPaymentLink } from "@/lib/payment-link-types";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { PayPageNavbar } from "@/components/pay/pay-page-navbar";
import { useOnchainPayment } from "@/components/pay/use-onchain-payment";
import { useSolanaPayment } from "@/components/pay/use-solana-payment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "@/lib/payment-contracts";
import {
  formatAtomicTokenAmount,
  shouldShowMetamaskAtomicAmountHint,
} from "@/lib/payment/register-wallet-token";
import { truncateAddress } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

function PaidReceipt({
  link,
  displayTxHash,
  explorerUrl,
}: {
  link: PublicPaymentLink;
  displayTxHash: string | null;
  explorerUrl: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-2 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2Icon className="size-7 text-emerald-600" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-emerald-700">Payment complete</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">
          {link.amount}{" "}
          <span className="text-2xl text-muted-foreground">{link.tokenSymbol}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {link.invoiceReference
            ? `Invoice · @${link.username}`
            : `@${link.username}`}
          {" · "}
          {link.networkLabel}
        </p>
        {link.paidAtLabel ? (
          <p className="text-xs text-muted-foreground">{link.paidAtLabel}</p>
        ) : null}
      </div>

      {link.paidBy || displayTxHash ? (
        <div className="w-full space-y-3 rounded-xl border border-border/60 px-4 py-3 text-left">
          {link.paidBy ? (
            <DetailRow label="Paid by">
              <span className="font-mono text-xs">
                {truncateAddress(link.paidBy, 6)}
              </span>
            </DetailRow>
          ) : null}
          {displayTxHash ? (
            <DetailRow label="Transaction">
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  {truncateAddress(displayTxHash, 6)}
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="font-mono text-xs">
                  {truncateAddress(displayTxHash, 6)}
                </span>
              )}
            </DetailRow>
          ) : null}
        </div>
      ) : null}

      {explorerUrl ? (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/50",
          )}
        >
          View on explorer
          <ExternalLinkIcon className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

export function PaymentLinkCheckout({
  initialLink,
}: {
  initialLink: PublicPaymentLink;
}) {
  const [link, setLink] = useState(initialLink);
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);

  const displayTxHash = link.paidTxHash ?? confirmedTxHash;
  const explorerUrl =
    displayTxHash && link.networkId
      ? getTxExplorerUrl(link.networkId, displayTxHash)
      : null;

  const isSolana = link.networkId === "solana";

  const { openConnectModal } = useConnectModal();
  const evmPayment = useOnchainPayment();
  const solanaPayment = useSolanaPayment();

  const address = isSolana ? solanaPayment.address : evmPayment.address;
  const isConnected = isSolana ? solanaPayment.isConnected : evmPayment.isConnected;
  const isPaying = isSolana ? solanaPayment.isPaying : evmPayment.isPaying;

  const requiredChainId = isSolana
    ? null
    : getChainIdForNetwork(link.networkId);
  const isWrongNetwork =
    !isSolana &&
    isConnected &&
    requiredChainId != null &&
    evmPayment.chainId !== requiredChainId;

  const showPayActions = link.status === "pending" && link.canPay;

  const showMetamaskAmountHint =
    !isSolana &&
    shouldShowMetamaskAtomicAmountHint(link.networkId, link.tokenId);
  const tokenContract = showMetamaskAmountHint
    ? getTokenContract(link.networkId, link.tokenId)
    : null;

  async function recordPayment(txHash: string, payerAddress?: string) {
    const response = await fetch(
      `/api/pay/${link.username}/${link.publicId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerAddress: payerAddress ?? address,
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

    if (!isSolana && requiredChainId == null) {
      toast.error("Unsupported network");
      return;
    }

    try {
      const paymentInput = {
        recipientAddress: link.recipientAddress,
        amount: link.amount,
        tokenId: link.tokenId,
        networkId: link.networkId,
      };

      const { txHash, payerAddress } = isSolana
        ? await solanaPayment.executePayment(paymentInput)
        : await evmPayment.executePayment(paymentInput);

      setConfirmedTxHash(txHash);
      await recordPayment(txHash, payerAddress);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Payment failed. Try again.",
      );
    }
  }

  return (
    <div className="lcx-auth min-h-full bg-background">
      <PayPageNavbar />

      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
        <Card className="border-border/60 shadow-none">
          <CardContent className="px-6 py-8">
            {link.status === "paid" ? (
              <PaidReceipt
                link={link}
                displayTxHash={displayTxHash}
                explorerUrl={explorerUrl}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {link.invoiceReference ? "Invoice payment" : "Pay to"}
                    </p>
                    <h1 className="mt-1 text-lg font-semibold tracking-tight">
                      {link.invoiceReference ?? link.merchantName}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {link.invoiceReference
                        ? `Invoice · @${link.username}`
                        : `@${link.username}`}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 rounded-lg capitalize",
                      link.status === "expired" && "bg-red-100 text-red-700",
                      link.status === "pending" && "bg-amber-100 text-amber-700",
                    )}
                  >
                    {link.status}
                  </Badge>
                </div>

                {link.status === "expired" ? (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3">
                    <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <p className="text-sm text-red-800">
                      This payment link has expired and no longer accepts
                      payments.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-center">
                    <p className="text-4xl font-semibold tracking-tight tabular-nums">
                      {link.amount}{" "}
                      <span className="text-2xl text-muted-foreground">
                        {link.tokenSymbol}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {link.networkLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {link.expiresAtLabel}
                    </p>
                  </div>
                )}

                {showPayActions ? (
                  <div className="space-y-3">
                    {!link.recipientAddress ? (
                      <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                        This merchant has not configured a wallet to receive
                        payments yet.
                      </p>
                    ) : !isConnected ? (
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl"
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
                      <>
                        {isWrongNetwork ? (
                          <p className="text-center text-xs text-amber-700">
                            Switch to {link.networkLabel} to continue.
                          </p>
                        ) : (
                          <p className="text-center font-mono text-[11px] text-muted-foreground">
                            {truncateAddress(address ?? "", 4)}
                          </p>
                        )}
                        <Button
                          className="h-11 w-full rounded-xl"
                          disabled={isPaying}
                          onClick={handlePay}
                        >
                          {isPaying ? (
                            <>
                              <Loader2Icon className="size-4 animate-spin" />
                              Processing...
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
                        {showMetamaskAmountHint && tokenContract ? (
                          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                            MetaMask may show{" "}
                            <span className="font-mono">
                              {formatAtomicTokenAmount(
                                link.amount,
                                tokenContract.decimals,
                              )}
                            </span>{" "}
                            instead of {link.amount} {link.tokenSymbol}. That is
                            the same amount in smallest units (6 decimals) — not
                            1 million tokens.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <p className="mt-8 text-center font-mono text-[11px] text-muted-foreground">
              {link.publicId}
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            PayAgent
          </Link>
        </p>
      </div>
    </div>
  );
}
