"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { CalendarIcon, CopyIcon, Link2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { TokenUsdInfo } from "@/components/token-usd-info"
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
  getPaymentTokenIcon,
  getPaymentTokenIconClassName,
  getPaymentTokenIconSize,
  getTokensForNetwork,
  getTokenById,
  paymentNetworks,
} from "@/lib/create-payment-link-data"
import { useTokenPrices } from "@/hooks/use-token-prices"
import {
  formatTokenUsdPrice,
} from "@/lib/coingecko/format-price"
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
  tokenId: "",
  networkId: "",
  expiresAt: "",
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

function TokenPriceBadge({ price }: { price: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-green-500/40 bg-green-500/10 px-1 py-0.5 text-[10px] tabular-nums text-green-700">
      {formatTokenUsdPrice(price)}
    </span>
  )
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
    : false

  const availableTokens = React.useMemo(
    () => (draft.networkId ? getTokensForNetwork(draft.networkId) : []),
    [draft.networkId],
  )

  const availableTokenIds = React.useMemo(
    () => availableTokens.map((token) => token.id),
    [availableTokens],
  )

  const networkSelected = draft.networkId.length > 0

  const { getPrice, loading: pricesLoading } =
    useTokenPrices(networkSelected ? availableTokenIds : [])

  const selectedToken = draft.tokenId ? getTokenById(draft.tokenId) : undefined
  const selectedNetwork = draft.networkId ? getNetworkById(draft.networkId) : undefined
  const amountValue = Number(draft.amount)
  const paymentDetailsReady =
    networkSelected &&
    draft.tokenId.length > 0 &&
    draft.amount.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0

  const selectedTokenPrice = draft.tokenId ? getPrice(draft.tokenId) : null
  const amountUsdValue =
    selectedTokenPrice && paymentDetailsReady
      ? amountValue * selectedTokenPrice
      : null

  React.useEffect(() => {
    if (!open) return

    setDraft(initialDraft)
    setCreatedLink(null)
    setCopied(false)
    setSubmitting(false)
  }, [open])

  React.useEffect(() => {
    if (!draft.networkId) return

    if (
      draft.tokenId &&
      !availableTokens.some((token) => token.id === draft.tokenId)
    ) {
      setDraft((current) => ({
        ...current,
        tokenId: availableTokens[0]?.id ?? "",
      }))
    } else if (!draft.tokenId && availableTokens[0]) {
      setDraft((current) => ({
        ...current,
        tokenId: availableTokens[0].id,
      }))
    }
  }, [availableTokens, draft.networkId, draft.tokenId])

  React.useEffect(() => {
    if (paymentDetailsReady && !draft.expiresAt) {
      setDraft((current) => ({
        ...current,
        expiresAt: getDefaultExpirationValue(),
      }))
    }
  }, [paymentDetailsReady, draft.expiresAt])

  function updateDraft(partial: Partial<PaymentLinkDraft>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function selectNetwork(networkId: string) {
    setDraft((current) => {
      const nextNetworkId =
        current.networkId === networkId ? "" : networkId

      if (!nextNetworkId) {
        return {
          ...current,
          networkId: "",
          tokenId: "",
          amount: "",
          expiresAt: "",
        }
      }

      const tokens = getTokensForNetwork(nextNetworkId)
      const keepToken = tokens.some((token) => token.id === current.tokenId)

      return {
        ...current,
        networkId: nextNetworkId,
        tokenId: keepToken ? current.tokenId : (tokens[0]?.id ?? ""),
      }
    })
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
              : "Choose a network, then token and amount, then expiration."}
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
                  <span className="inline-flex items-center gap-1 font-medium">
                    {draft.amount} {selectedToken?.symbol ?? ""}
                    {draft.tokenId && Number(draft.amount) > 0 ? (
                      <TokenUsdInfo
                        amount={Number(draft.amount)}
                        tokenId={draft.tokenId}
                        symbol={selectedToken?.symbol}
                      />
                    ) : null}
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
                <Field>
                  <FieldLabel>Network</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {paymentNetworks.map((network) => {
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
                      {networkSelected
                        ? "Tap × to clear, or pick another network."
                        : "Select a network to unlock token and amount."}
                    </FieldDescription>
                  )}
                </Field>

                <div
                  className={cn(
                    "grid grid-cols-2 gap-4 transition-opacity",
                    !networkSelected && "pointer-events-none opacity-45",
                  )}
                >
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
                      disabled={!networkSelected}
                      onChange={(event) => {
                        const amount = event.target.value
                        const parsed = Number(amount)
                        const hasValidAmount =
                          amount.trim().length > 0 &&
                          Number.isFinite(parsed) &&
                          parsed > 0

                        updateDraft({
                          amount,
                          expiresAt: hasValidAmount ? draft.expiresAt : "",
                        })
                      }}
                      className="h-9 w-full py-0 font-mono"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="payment-token">Token</FieldLabel>
                    <Select
                      value={draft.tokenId || null}
                      disabled={!networkSelected || availableTokens.length === 0}
                      onValueChange={(value) =>
                        updateDraft({
                          tokenId: value ?? "",
                        })
                      }
                      items={availableTokens.map((token) => ({
                        label: token.symbol,
                        value: token.id,
                      }))}
                    >
                      <SelectTrigger
                        id="payment-token"
                        className="h-9 w-full min-w-0 py-0 data-[size=default]:h-9"
                      >
                        <SelectValue placeholder="Select token">
                          {selectedToken ? (
                            <span className="flex items-center gap-2">
                              {getPaymentTokenIcon(selectedToken.id) ? (
                                <Image
                                  src={getPaymentTokenIcon(selectedToken.id)!}
                                  alt=""
                                  width={getPaymentTokenIconSize(selectedToken.id)}
                                  height={getPaymentTokenIconSize(
                                    selectedToken.id,
                                  )}
                                  className={getPaymentTokenIconClassName(
                                    selectedToken.id,
                                  )}
                                />
                              ) : null}
                              {selectedToken.symbol}
                            </span>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {availableTokens.map((token) => {
                            const iconSrc = getPaymentTokenIcon(token.id)
                            const iconSize = getPaymentTokenIconSize(token.id)
                            const tokenPrice = getPrice(token.id)
                            return (
                              <SelectItem key={token.id} value={token.id}>
                                <span className="flex w-full min-w-0 items-center justify-between gap-3">
                                  <span className="flex min-w-0 items-center gap-2">
                                    {iconSrc ? (
                                      <Image
                                        src={iconSrc}
                                        alt=""
                                        width={iconSize}
                                        height={iconSize}
                                        className={getPaymentTokenIconClassName(
                                          token.id,
                                        )}
                                      />
                                    ) : null}
                                    {token.symbol}
                                  </span>
                                  {tokenPrice ? (
                                    <TokenPriceBadge price={tokenPrice} />
                                  ) : pricesLoading ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      …
                                    </span>
                                  ) : null}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {paymentDetailsReady && amountUsdValue != null ? (
                  <FieldDescription className="-mt-2 text-xs tabular-nums">
                    ≈ {formatTokenUsdPrice(amountUsdValue)} USD
                  </FieldDescription>
                ) : null}

                <Field
                  className={cn(
                    "transition-opacity",
                    !paymentDetailsReady && "pointer-events-none opacity-45",
                  )}
                >
                  <FieldLabel htmlFor="payment-expiration">
                    Expiration
                  </FieldLabel>
                  {!paymentDetailsReady ? (
                    <FieldDescription className="mb-2">
                      Enter a token and amount to set expiration.
                    </FieldDescription>
                  ) : null}
                  <Popover>
                    <PopoverTrigger
                      id="payment-expiration"
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!paymentDetailsReady}
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
