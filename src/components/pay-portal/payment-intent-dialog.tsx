"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useOnchainPayment } from "@/components/pay/use-onchain-payment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import { truncateAddress } from "@/lib/profile-url";
import { supportsOnChainPayment } from "@/lib/payment-contracts";
import { cn } from "@/lib/utils";

type PendingIntent = {
  intentId: string;
  externalAgentId: string;
  status?: string;
  autoExecute?: boolean;
  type?: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
  recipientUsername?: string;
  recipientAddress?: string | null;
  savedAddress?: { name: string; line1: string; city: string } | null;
};

type SignPayload = {
  intentId: string;
  type: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
  recipientUsername?: string;
  recipientAddress?: string;
};

type FlowPhase = "review" | "processing" | "success" | "error";

type ProcessingStep = "approving" | "wallet" | "recording";

type SuccessState = {
  txHash: string;
  recipientUsername?: string;
  recipientAddress?: string;
  amount?: number;
  tokenId?: string;
  networkId?: string;
};

function formatToken(tokenId?: string) {
  if (!tokenId) return "";
  return tokenId.toUpperCase();
}

function formatNetwork(networkId?: string) {
  if (!networkId) return "";
  return networkId.charAt(0).toUpperCase() + networkId.slice(1);
}

function IntentDetails({ intent }: { intent: PendingIntent }) {
  const recipientLabel = intent.recipientUsername
    ? `@${intent.recipientUsername}`
    : intent.recipientAddress
      ? truncateAddress(intent.recipientAddress, 6)
      : null;

  const rows = [
    { label: "Agent", value: intent.externalAgentId },
    recipientLabel ? { label: "Recipient", value: recipientLabel } : null,
    intent.amount != null
      ? {
          label: "Amount",
          value: `${intent.amount} ${formatToken(intent.tokenId)}`.trim(),
        }
      : null,
    intent.networkId ? { label: "Network", value: formatNetwork(intent.networkId) } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium text-foreground">{row.value}</span>
        </div>
      ))}
      {intent.savedAddress ? (
        <div className="border-t border-border/60 pt-3 text-sm">
          <span className="text-muted-foreground">Billing contact</span>
          <p className="mt-1 font-medium text-foreground">{intent.savedAddress.name}</p>
          <p className="text-muted-foreground">
            {intent.savedAddress.line1}, {intent.savedAddress.city}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function processingMessage(step: ProcessingStep) {
  switch (step) {
    case "approving":
      return "Approving payment request…";
    case "wallet":
      return "Confirm the transaction in your wallet…";
    case "recording":
      return "Recording payment on Fidence…";
  }
}

const dialogFooterClassName = "border-t border-border/50 bg-muted/20 px-6 py-4";
const primaryCtaClassName = "h-10 flex-1 rounded-xl";
const secondaryCtaClassName = "h-10 flex-1 rounded-xl";

function getPayButtonLabel(intent: PendingIntent) {
  const amountLabel =
    intent.amount != null && intent.tokenId
      ? `${intent.amount} ${formatToken(intent.tokenId)}`
      : null;

  if (intent.status === "approved") {
    return amountLabel ? `Pay ${amountLabel}` : "Pay now";
  }

  if (intent.type === "address") {
    return amountLabel ? `Pay ${amountLabel}` : "Pay now";
  }

  return amountLabel ? `Approve & pay ${amountLabel}` : "Approve & pay";
}

export function PaymentIntentDialog() {
  const [intents, setIntents] = useState<PendingIntent[]>([]);
  const [current, setCurrent] = useState<PendingIntent | null>(null);
  const [phase, setPhase] = useState<FlowPhase>("review");
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("approving");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvedContext, setApprovedContext] = useState<{
    payload: SignPayload;
    recipientAddress: string;
  } | null>(null);

  const [acting, setActing] = useState(false);

  const { openConnectModal } = useConnectModal();
  const { executePayment, isConnected, isPaying } = useOnchainPayment();

  const poll = useCallback(async () => {
    if (phase !== "review") return;
    try {
      const res = await fetch("/api/pay/payment-intents?status=manual");
      if (!res.ok) return;
      const data = (await res.json()) as { intents?: PendingIntent[] };
      const list = (data.intents ?? [])
        .filter(
          (item) =>
            !item.autoExecute &&
            !(item.type === "profile" && item.recipientUsername === "example"),
        )
        .sort((a, b) => {
          if (a.type === "address" && b.type !== "address") return -1;
          if (b.type === "address" && a.type !== "address") return 1;
          return 0;
        });
      setIntents(list);
      setCurrent((prev) => {
        if (prev && list.some((item) => item.intentId === prev.intentId)) return prev;
        return list[0] ?? null;
      });
    } catch {
      // Ignore transient poll errors.
    }
  }, [phase]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), 8000);
    return () => window.clearInterval(timer);
  }, [poll]);

  function resetFlow() {
    setPhase("review");
    setProcessingStep("approving");
    setSuccess(null);
    setErrorMessage(null);
    setApprovedContext(null);
    setActing(false);
    setCurrent(null);
  }

  async function handleReject() {
    if (!current) return;
    setActing(true);
    try {
      const res = await fetch(`/api/pay/payment-intents/${current.intentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Action failed");
        return;
      }
      toast.success("Payment declined");
      resetFlow();
      await poll();
    } finally {
      setActing(false);
    }
  }

  async function handleApproveAndPay() {
    if (!current) return;

    if (current.networkId === "solana") {
      toast.error("Solana agent payments are not supported in the portal yet.");
      return;
    }

    if (
      !current.networkId ||
      !current.tokenId ||
      current.amount == null ||
      !supportsOnChainPayment(current.networkId, current.tokenId)
    ) {
      toast.error("This token/network combination is not supported yet.");
      return;
    }

    if (!isConnected) {
      openConnectModal?.();
      toast.message("Connect your wallet to approve and pay.");
      return;
    }

    setActing(true);
    setPhase("processing");
    setErrorMessage(null);

    try {
      let payload = approvedContext?.payload;
      let recipientAddress = approvedContext?.recipientAddress;

      if (!payload || !recipientAddress) {
        const intentRecipient = current.recipientAddress?.trim();
        if (intentRecipient && (current.type === "address" || !current.recipientUsername)) {
          payload = {
            intentId: current.intentId,
            type: current.type ?? "address",
            amount: current.amount,
            tokenId: current.tokenId,
            networkId: current.networkId,
            recipientUsername: current.recipientUsername,
            recipientAddress: intentRecipient,
          };
          recipientAddress = intentRecipient;
          if (current.status === "pending") {
            setProcessingStep("approving");
            const approveRes = await fetch(`/api/pay/payment-intents/${current.intentId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "approve" }),
            });
            if (!approveRes.ok) {
              const approveData = (await approveRes.json()) as { error?: string };
              throw new Error(approveData.error ?? "Approval failed");
            }
          }
          setApprovedContext({ payload, recipientAddress });
        } else if (current.status === "approved" && current.recipientAddress) {
          payload = {
            intentId: current.intentId,
            type: current.type ?? "address",
            amount: current.amount,
            tokenId: current.tokenId,
            networkId: current.networkId,
            recipientUsername: current.recipientUsername,
            recipientAddress: current.recipientAddress,
          };
          recipientAddress = current.recipientAddress.trim();
          setApprovedContext({ payload, recipientAddress });
        } else {
          setProcessingStep("approving");
          const approveRes = await fetch(`/api/pay/payment-intents/${current.intentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          });
          const approveData = (await approveRes.json()) as {
            error?: string;
            signPayload?: SignPayload;
            recipientAddress?: string | null;
          };

          if (!approveRes.ok) {
            throw new Error(approveData.error ?? "Approval failed");
          }

          payload = approveData.signPayload;
          recipientAddress =
            approveData.recipientAddress?.trim() ??
            approveData.signPayload?.recipientAddress?.trim() ??
            current.recipientAddress?.trim() ??
            undefined;
          if (!payload || !recipientAddress) {
            if (current.type === "profile" && current.recipientUsername) {
              throw new Error(
                `@${current.recipientUsername} has no verified wallet on ${formatNetwork(current.networkId)}. Add one on /wallets or send to a raw address instead.`,
              );
            }
            throw new Error("Recipient wallet is not configured for this payment.");
          }
          setApprovedContext({ payload, recipientAddress });
        }
      }

      setProcessingStep("wallet");
      const { txHash, payerAddress } = await executePayment({
        recipientAddress,
        amount: payload.amount ?? current.amount,
        tokenId: payload.tokenId ?? current.tokenId,
        networkId: payload.networkId ?? current.networkId,
      });

      setProcessingStep("recording");
      const completeRes = await fetch(
        `/api/pay/payment-intents/${current.intentId}/complete`,
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
            "Payment was sent but could not be recorded. Save your transaction hash and contact support.",
        );
      }

      setSuccess({
        txHash,
        recipientUsername: payload.recipientUsername ?? current.recipientUsername,
        recipientAddress: payload.recipientAddress ?? current.recipientAddress ?? undefined,
        amount: payload.amount ?? current.amount,
        tokenId: payload.tokenId ?? current.tokenId,
        networkId: payload.networkId ?? current.networkId,
      });
      setPhase("success");
      setApprovedContext(null);
      await poll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      setErrorMessage(message);
      setPhase("error");
      toast.error(message);
    } finally {
      setActing(false);
    }
  }

  const open = Boolean(current) || phase === "success";
  const explorerUrl =
    success?.networkId && success.txHash
      ? getTxExplorerUrl(success.networkId, success.txHash)
      : null;

  return (
    <>
      {intents.length > 0 && phase === "review" && !current ? (
        <button
          type="button"
          className="fixed bottom-4 right-4 z-50"
          onClick={() => setCurrent(intents[0] ?? null)}
        >
          <Badge className="cursor-pointer px-3 py-1.5 text-xs shadow-md">
            {intents.length} pending payment{intents.length === 1 ? "" : "s"}
          </Badge>
        </button>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) resetFlow();
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {phase === "success" && success ? (
            <>
              <div className="space-y-4 px-6 py-8 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2Icon className="size-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl font-normal tracking-tight">
                    Payment successful
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {success.amount} {formatToken(success.tokenId)} sent to{" "}
                    {success.recipientUsername
                      ? `@${success.recipientUsername}`
                      : success.recipientAddress
                        ? truncateAddress(success.recipientAddress, 6)
                        : "recipient"}{" "}
                    on {formatNetwork(success.networkId)}.
                  </p>
                </div>
                {explorerUrl ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    className="mx-auto"
                    render={<Link href={explorerUrl} target="_blank" rel="noreferrer" />}
                  >
                    View transaction
                    <ExternalLinkIcon className="ml-2 size-4" />
                  </Button>
                ) : null}
              </div>
              <DialogFooter className={dialogFooterClassName}>
                <Button className="h-9 w-full" onClick={resetFlow}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "processing" && current ? (
            <>
              <div className="space-y-5 px-6 py-10 text-center">
                <Loader2Icon className="mx-auto size-10 animate-spin text-primary" />
                <div className="space-y-2">
                  <h2 className="font-serif text-xl font-normal tracking-tight">
                    Processing payment
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {processingMessage(processingStep)}
                  </p>
                </div>
                <IntentDetails intent={current} />
              </div>
            </>
          ) : null}

          {phase === "error" ? (
            <>
              <div className="space-y-4 px-6 py-8">
                <div className="space-y-2 text-center">
                  <h2 className="font-serif text-xl font-normal tracking-tight">
                    Payment could not be completed
                  </h2>
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
              <DialogFooter className={dialogFooterClassName}>
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    className={secondaryCtaClassName}
                    onClick={resetFlow}
                  >
                    Close
                  </Button>
                  {current ? (
                    <Button
                      className={primaryCtaClassName}
                      onClick={() => {
                        setPhase("processing");
                        void handleApproveAndPay();
                      }}
                      disabled={acting || isPaying}
                    >
                      {acting || isPaying ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <WalletIcon className="size-4" />
                          Try again
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : null}

          {phase === "review" && current ? (
            <>
              <DialogHeader className="gap-3 border-b border-border/60 px-6 pb-4 pt-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/30 text-muted-foreground">
                    <WalletIcon className="size-4" />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <DialogTitle className="font-serif text-xl font-normal tracking-tight">
                      {current.type === "address"
                        ? "Confirm agent payment"
                        : current.status === "approved"
                          ? "Complete agent payment"
                          : "Approve agent payment"}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">
                      {current.type === "address"
                        ? "This payment is within your mandate. Confirm in your wallet to send funds to the recipient address."
                        : current.status === "approved"
                          ? "You approved this payment. Confirm in your wallet to send the funds."
                          : "A linked agent is requesting this payment. After you approve, your wallet will open to send the funds."}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5">
                <IntentDetails intent={current} />
              </div>

              <DialogFooter className={dialogFooterClassName}>
                <div
                  className={cn(
                    "flex w-full gap-2",
                    current.status === "approved" ? "flex-col" : "flex-col sm:flex-row",
                  )}
                >
                  {current.status !== "approved" ? (
                    <Button
                      variant="outline"
                      className={secondaryCtaClassName}
                      onClick={() => void handleReject()}
                      disabled={acting || isPaying}
                    >
                      Decline
                    </Button>
                  ) : null}
                  <Button
                    className={cn(
                      primaryCtaClassName,
                      current.status === "approved" && "w-full flex-none",
                    )}
                    onClick={() => void handleApproveAndPay()}
                    disabled={acting || isPaying}
                  >
                    {acting || isPaying ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <WalletIcon className="size-4" />
                        {getPayButtonLabel(current)}
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
