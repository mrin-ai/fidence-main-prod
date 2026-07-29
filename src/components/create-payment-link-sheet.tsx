"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { CalendarIcon, CopyIcon, Link2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  getDefaultExpirationValue,
  getNetworkById,
  getNetworksForToken,
  getPaymentTokenIcon,
  getSupportedPaymentTokens,
  getTokenById,
} from "@/lib/create-payment-link-data"
import { getWalletNetworkIcon } from "@/lib/wallet-networks"
import { cn } from "@/lib/utils"

type PaymentLinkDraft = {
  amount: string
  tokenId: string
  networkId: string
  expiresAt: string
}

const initialDraft: PaymentLinkDraft = {
  amount: "",
  tokenId: "usdc",
  networkId: "",
  expiresAt: getDefaultExpirationValue(),
}

function parseLocalDatetime(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function toLocalDatetimeValue(date: Date) {
  const copy = new Date(date)
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset())
  return copy.toISOString().slice(0, 16)
}

function mergeExpirationDate(current: string, next: Date | undefined) {
  if (!next) return ""
  const previous = parseLocalDatetime(current) ?? new Date()
  const merged = new Date(next)
  merged.setHours(
    previous.getHours(),
    previous.getMinutes(),
    previous.getSeconds(),
    0,
  )
  return toLocalDatetimeValue(merged)
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
      "useCreatePaymentLink must be used within CreatePaymentLinkProvider",
    )
  }
  return context
}

function CreatePaymentLinkModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = React.useState<PaymentLinkDraft>(initialDraft)
  const [createdLink, setCreatedLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [verifiedNetworkIds, setVerifiedNetworkIds] = React.useState<string[]>(
    [],
  )
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
    [draft.tokenId],
  )

  const selectedToken = getTokenById(draft.tokenId)
  const selectedNetwork = getNetworkById(draft.networkId)

  React.useEffect(() => {
    if (!open) return

    setDraft(initialDraft)
    setCreatedLink(null)
    setCopied(false)
    setSubmitting(false)
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

  function selectNetwork(networkId: string) {
    setDraft((current) => ({
      ...current,
      networkId: current.networkId === networkId ? "" : networkId,
    }))
  }

  const canCreate =
    draft.amount.trim().length > 0 &&
    Number(draft.amount) > 0 &&
    draft.tokenId.length > 0 &&
    draft.networkId.length > 0 &&
    draft.expiresAt.length > 0 &&
    hasVerifiedWalletForNetwork

  async function handleCreate() {
    if (!canCreate || submitting) return

    setSubmitting(true)
    try {
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
          toast.error(
            payload.error ?? "Add a verified wallet for this network",
          )
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
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!createdLink) return
    await navigator.clipboard.writeText(createdLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const expirationDate = parseLocalDatetime(draft.expiresAt)
  const formattedExpiration = expirationDate
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(expirationDate)
    : "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 pt-5 pb-4">
          <DialogTitle className="text-base">
            {createdLink ? "Link created" : "Create payment link"}
          </DialogTitle>
          <DialogDescription>
            {createdLink
              ? "Share this link with anyone who needs to pay."
              : "Set amount, token, network, and expiration."}
          </DialogDescription>
        </DialogHeader>

        {createdLink ? (
          <>
            <div className="space-y-4 px-5 py-5">
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
                  onClick={() => void handleCopy()}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              </div>
              {copied ? (
                <p className="text-xs text-muted-foreground">Link copied</p>
              ) : null}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {draft.amount} {selectedToken?.symbol ?? ""}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium">
                    {selectedNetwork?.label ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">{formattedExpiration}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-border/50 bg-muted/20 px-5 py-4">
              <Button
                type="button"
                className="h-9 w-full"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="px-5 py-5">
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
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
                      className="h-9 font-mono"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="payment-token">Token</FieldLabel>
                    <Select
                      value={draft.tokenId}
                      onValueChange={(value) =>
                        updateDraft({
                          tokenId: value ?? "usdc",
                          networkId: "",
                        })
                      }
                      items={supportedTokens.map((token) => ({
                        label: token.symbol,
                        value: token.id,
                      }))}
                    >
                      <SelectTrigger id="payment-token" className="h-9 w-full">
                        <SelectValue placeholder="Select token">
                          {selectedToken ? (
                            <span className="flex items-center gap-2">
                              {getPaymentTokenIcon(selectedToken.id) ? (
                                <Image
                                  src={getPaymentTokenIcon(selectedToken.id)!}
                                  alt=""
                                  width={selectedToken.id === "eth" ? 18 : 16}
                                  height={selectedToken.id === "eth" ? 18 : 16}
                                  className={
                                    selectedToken.id === "eth"
                                      ? "size-[18px] shrink-0 object-contain"
                                      : "size-4 shrink-0 object-contain"
                                  }
                                />
                              ) : null}
                              {selectedToken.symbol}
                            </span>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {supportedTokens.map((token) => {
                            const iconSrc = getPaymentTokenIcon(token.id)
                            return (
                              <SelectItem key={token.id} value={token.id}>
                                <span className="flex items-center gap-2">
                                  {iconSrc ? (
                                    <Image
                                      src={iconSrc}
                                      alt=""
                                      width={token.id === "eth" ? 18 : 16}
                                      height={token.id === "eth" ? 18 : 16}
                                      className={
                                        token.id === "eth"
                                          ? "size-[18px] shrink-0 object-contain"
                                          : "size-4 shrink-0 object-contain"
                                      }
                                    />
                                  ) : null}
                                  {token.symbol}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Network</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {availableNetworks.map((network) => {
                      const isSelected = draft.networkId === network.id
                      const iconSrc = getWalletNetworkIcon(network.id)

                      return (
                        <Badge
                          key={network.id}
                          variant={isSelected ? "default" : "outline"}
                          render={<button type="button" />}
                          aria-pressed={isSelected}
                          aria-label={
                            isSelected
                              ? `${network.label}, selected. Click to unselect`
                              : `Select ${network.label}`
                          }
                          onClick={() => selectNetwork(network.id)}
                          className={cn(
                            "h-7 cursor-pointer gap-1.5 px-2.5 text-xs",
                            isSelected && "pr-1.5",
                          )}
                        >
                          {iconSrc ? (
                            <Image
                              src={iconSrc}
                              alt=""
                              width={network.id === "base" ? 14 : 18}
                              height={network.id === "base" ? 14 : 18}
                              className={cn(
                                "shrink-0 object-contain",
                                network.id === "base"
                                  ? "size-3.5"
                                  : "size-[18px]",
                                isSelected && "brightness-0 invert",
                              )}
                            />
                          ) : null}
                          {network.label}
                          {isSelected ? (
                            <XIcon
                              data-icon="inline-end"
                              className="size-3.5 opacity-90"
                            />
                          ) : null}
                        </Badge>
                      )
                    })}
                  </div>
                  {draft.networkId && !hasVerifiedWalletForNetwork ? (
                    <FieldDescription className="text-amber-700">
                      Add and verify a wallet for{" "}
                      {selectedNetwork?.label ?? draft.networkId} in{" "}
                      <Link href="/wallets" className="font-medium underline">
                        Wallets
                      </Link>{" "}
                      first.
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      Tap × to clear, or pick another network.
                    </FieldDescription>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="payment-expiration">
                    Expiration
                  </FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      id="payment-expiration"
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "h-9 w-full justify-start text-left font-normal",
                            !draft.expiresAt && "text-muted-foreground",
                          )}
                        />
                      }
                    >
                      <CalendarIcon className="size-4" />
                      {expirationDate
                        ? format(expirationDate, "PPP")
                        : "Pick a date"}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expirationDate}
                        onSelect={(date) =>
                          updateDraft({
                            expiresAt: mergeExpirationDate(
                              draft.expiresAt,
                              date,
                            ),
                          })
                        }
                        captionLayout="dropdown"
                        startMonth={
                          new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                          )
                        }
                        endMonth={
                          new Date(
                            new Date().getFullYear() + 2,
                            new Date().getMonth(),
                          )
                        }
                        disabled={{
                          before: new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                            new Date().getDate(),
                          ),
                        }}
                        className="rounded-lg"
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20 px-5 py-4">
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 flex-1"
                  disabled={!canCreate || submitting}
                  onClick={() => void handleCreate()}
                >
                  {submitting ? "Creating…" : "Create link"}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
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
    [],
  )

  return (
    <CreatePaymentLinkContext.Provider value={value}>
      {children}
      <CreatePaymentLinkModal open={open} onOpenChange={setOpen} />
    </CreatePaymentLinkContext.Provider>
  )
}
