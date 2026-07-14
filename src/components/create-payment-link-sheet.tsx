"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, CheckIcon, CopyIcon, Link2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getDefaultExpirationValue,
  getNetworkById,
  getNetworksForToken,
  getSupportedPaymentTokens,
  getTokenById,
} from "@/lib/create-payment-link-data"
import { cn } from "@/lib/utils"

type Step = 1 | 2 | 3 | 4

type PaymentLinkDraft = {
  amount: string
  tokenId: string
  networkId: string
  expiresAt: string
}

const stepLabels: Record<Step, { title: string; description: string }> = {
  1: {
    title: "Amount & token",
    description: "Enter how much you want to collect and choose a token.",
  },
  2: {
    title: "Network",
    description: "Select the network for this payment link.",
  },
  3: {
    title: "Expiration",
    description: "Set when this payment link should expire.",
  },
  4: {
    title: "Preview",
    description: "Review the details before creating your link.",
  },
}

const initialDraft: PaymentLinkDraft = {
  amount: "",
  tokenId: "usdc",
  networkId: "",
  expiresAt: getDefaultExpirationValue(),
}

type CreatePaymentLinkContextValue = {
  openCreatePaymentLink: () => void
}

const CreatePaymentLinkContext =
  React.createContext<CreatePaymentLinkContextValue | null>(null)

export function useCreatePaymentLink() {
  const context = React.useContext(CreatePaymentLinkContext)
  if (!context) {
    throw new Error(
      "useCreatePaymentLink must be used within CreatePaymentLinkProvider"
    )
  }
  return context
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((value) => (
        <div
          key={value}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            value <= step ? "bg-primary" : "bg-border"
          )}
        />
      ))}
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}

function CreatePaymentLinkModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = React.useState<Step>(1)
  const [draft, setDraft] = React.useState<PaymentLinkDraft>(initialDraft)
  const [createdLink, setCreatedLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [verifiedNetworkIds, setVerifiedNetworkIds] = React.useState<string[]>([])
  const router = useRouter()

  React.useEffect(() => {
    if (!open) return

    void fetch("/api/wallets")
      .then((response) => response.json())
      .then((data: { verifiedNetworkIds?: string[] }) => {
        setVerifiedNetworkIds(data.verifiedNetworkIds ?? [])
      })
      .catch(() => setVerifiedNetworkIds([]))
  }, [open])

  const hasVerifiedWalletForNetwork = draft.networkId
    ? verifiedNetworkIds.includes(draft.networkId)
    : true

  const supportedTokens = React.useMemo(() => getSupportedPaymentTokens(), [])

  const availableNetworks = React.useMemo(
    () => getNetworksForToken(draft.tokenId),
    [draft.tokenId]
  )

  const selectedToken = getTokenById(draft.tokenId)
  const selectedNetwork = getNetworkById(draft.networkId)

  React.useEffect(() => {
    if (!open) return

    setStep(1)
    setDraft(initialDraft)
    setCreatedLink(null)
    setCopied(false)
  }, [open])

  React.useEffect(() => {
    if (
      draft.tokenId &&
      !supportedTokens.some((token) => token.id === draft.tokenId)
    ) {
      setDraft((current) => ({
        ...current,
        tokenId: supportedTokens[0]?.id ?? "usdc",
        networkId: "",
      }))
    }
  }, [draft.tokenId, supportedTokens])

  React.useEffect(() => {
    if (
      draft.networkId &&
      !availableNetworks.some((network) => network.id === draft.networkId)
    ) {
      setDraft((current) => ({ ...current, networkId: "" }))
    }
  }, [availableNetworks, draft.networkId])

  function updateDraft(partial: Partial<PaymentLinkDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function canContinue() {
    if (step === 1) {
      return draft.amount.trim().length > 0 && Number(draft.amount) > 0
    }
    if (step === 2) {
      return draft.networkId.length > 0
    }
    if (step === 3) {
      return draft.expiresAt.length > 0
    }
    return true
  }

  async function handleContinue() {
    if (step < 4) {
      setStep((current) => (current + 1) as Step)
      return
    }

    const response = await fetch("/api/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: draft.amount,
        tokenId: draft.tokenId,
        networkId: draft.networkId,
        expiresAt: new Date(draft.expiresAt).toISOString(),
      }),
    })

    const payload = (await response.json()) as {
      url?: string
      error?: string
      code?: string
    }

    if (!response.ok) {
      if (payload.code === "USERNAME_REQUIRED") {
        toast.error("Set a username in Settings before creating links")
      } else if (payload.code === "WALLET_NOT_VERIFIED_FOR_NETWORK") {
        toast.error(payload.error ?? "Add a verified wallet for this network")
      } else if (payload.code === "WALLET_REQUIRED") {
        toast.error("Connect a wallet to your account to receive payments")
      } else {
        toast.error(payload.error ?? "Failed to create payment link")
      }
      return
    }

    if (!payload.url) {
      toast.error("Failed to create payment link")
      return
    }

    setCreatedLink(payload.url)
    toast.success("Payment link created")
    router.refresh()
  }

  function handleBack() {
    if (step > 1) {
      setStep((current) => (current - 1) as Step)
    }
  }

  async function handleCopy() {
    if (!createdLink) return
    await navigator.clipboard.writeText(createdLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const formattedExpiration = draft.expiresAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(draft.expiresAt))
    : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium text-muted-foreground">
            Step {step} of 4
          </p>
          <DialogTitle>{stepLabels[step].title}</DialogTitle>
          <DialogDescription>{stepLabels[step].description}</DialogDescription>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="flex max-h-[min(28rem,calc(100vh-16rem))] flex-col gap-5 overflow-y-auto px-6 py-6">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  onChange={(event) =>
                    updateDraft({ amount: event.target.value })
                  }
                  className="h-10 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-token">Token</Label>
                <Select
                  value={draft.tokenId}
                  onValueChange={(value) =>
                    updateDraft({ tokenId: value ?? "usdc", networkId: "" })
                  }
                  items={supportedTokens.map((token) => ({
                    label: token.symbol,
                    value: token.id,
                  }))}
                >
                  <SelectTrigger id="payment-token" className="h-10 w-full">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {supportedTokens.map((token) => (
                        <SelectItem key={token.id} value={token.id}>
                          {token.symbol} · {token.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3">
              {availableNetworks.map((network) => {
                const isSelected = draft.networkId === network.id
                return (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => updateDraft({ networkId: network.id })}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-secondary text-secondary-foreground"
                        : "border-border/50 bg-card hover:border-primary/30 hover:bg-secondary/40"
                    )}
                  >
                    <span className="text-sm font-medium">{network.label}</span>
                    {isSelected ? (
                      <CheckIcon className="size-4 text-primary" />
                    ) : null}
                  </button>
                )
              })}
              {draft.networkId && !hasVerifiedWalletForNetwork ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Add and verify a wallet for {selectedNetwork?.label ?? draft.networkId} in{" "}
                  <Link href="/wallets" className="font-medium underline">
                    Wallets
                  </Link>{" "}
                  before creating this link.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2">
              <Label htmlFor="payment-expiration">Expiration date & time</Label>
              <Input
                id="payment-expiration"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(event) =>
                  updateDraft({ expiresAt: event.target.value })
                }
                className="h-10"
              />
            </div>
          ) : null}

          {step === 4 && !createdLink ? (
            <div className="space-y-4 rounded-xl border border-border/50 bg-secondary/30 p-4">
              <PreviewRow
                label="Amount"
                value={`${draft.amount} ${selectedToken?.symbol ?? ""}`}
              />
              <PreviewRow label="Token" value={selectedToken?.label ?? "—"} />
              <PreviewRow label="Network" value={selectedNetwork?.label ?? "—"} />
              <PreviewRow label="Expires" value={formattedExpiration} />
            </div>
          ) : null}

          {step === 4 && createdLink ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary px-3 py-2.5">
                <Link2Icon className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 break-all font-mono text-sm">
                  {createdLink}
                </p>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-primary"
                  aria-label="Copy payment link"
                  onClick={handleCopy}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              </div>
              {copied ? (
                <p className="text-xs text-secondary-foreground">Link copied</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Share this link with anyone who needs to pay. Format:{" "}
                <span className="font-mono">domain/username/id</span>
              </p>
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
                <PreviewRow
                  label="Amount"
                  value={`${draft.amount} ${selectedToken?.symbol ?? ""}`}
                />
                <div className="mt-3 space-y-3">
                  <PreviewRow label="Network" value={selectedNetwork?.label ?? "—"} />
                  <PreviewRow label="Expires" value={formattedExpiration} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/50">
          <div className="flex w-full gap-2">
            {step > 1 && !createdLink ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleBack}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              className="flex-1"
              disabled={!createdLink && (!canContinue() || (step === 4 && !hasVerifiedWalletForNetwork))}
              onClick={() => {
                if (createdLink) {
                  onOpenChange(false)
                  return
                }
                handleContinue()
              }}
            >
              {step === 4 && !createdLink
                ? "Create link"
                : createdLink
                  ? "Done"
                  : "Continue"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CreatePaymentLinkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  const value = React.useMemo(
    () => ({
      openCreatePaymentLink: () => setOpen(true),
    }),
    []
  )

  return (
    <CreatePaymentLinkContext.Provider value={value}>
      {children}
      <CreatePaymentLinkModal open={open} onOpenChange={setOpen} />
    </CreatePaymentLinkContext.Provider>
  )
}
