"use client"

import * as React from "react"
import { CopyIcon, Link2Icon, QrCodeIcon } from "lucide-react"
import QRCode from "react-qr-code"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const balanceVisuals: Record<
  string,
  { iconClassName: string; icon: string }
> = {
  usdc: {
    iconClassName: "bg-primary text-primary-foreground",
    icon: "$",
  },
  eth: {
    iconClassName: "bg-chart-2 text-primary-foreground",
    icon: "Ξ",
  },
  sol: {
    iconClassName:
      "bg-gradient-to-br from-purple-500 to-teal-400 text-primary-foreground",
    icon: "S",
  },
}

type ScanQrBalance = {
  id: string
  label: string
  value: string
}

type ScanQrContextValue = {
  openScanQr: () => void
}

const ScanQrContext = React.createContext<ScanQrContextValue | null>(null)

export function useScanQr() {
  const context = React.useContext(ScanQrContext)
  if (!context) {
    throw new Error("useScanQr must be used within ScanQrProvider")
  }
  return context
}

function PayQrCode({ paymentUrl }: { paymentUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-[15rem] rounded-[1.25rem] border border-border/60 bg-white p-5 shadow-none">
      <div className="overflow-hidden rounded-xl bg-white p-2">
        <QRCode
          value={paymentUrl}
          size={192}
          bgColor="#FFFFFF"
          fgColor="#0F1729"
          level="M"
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          viewBox="0 0 256 256"
        />
      </div>
    </div>
  )
}

function ScanQrDrawerPanel({
  open,
  onOpenChange,
  paymentLink,
  balances,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentLink: string
  balances: ScanQrBalance[]
}) {
  const [copied, setCopied] = React.useState(false)
  const paymentUrl = paymentLink.startsWith("http")
    ? paymentLink
    : `https://${paymentLink}`

  async function handleCopy() {
    await navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full max-h-none w-full data-[vaul-drawer-direction=right]:sm:max-w-md">
        <DrawerHeader className="border-b border-border/50 pb-4 text-left">
          <DrawerTitle className="text-lg font-semibold">Get paid</DrawerTitle>
          <DrawerDescription>
            Share a link or QR to receive instantly.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary px-3 py-2.5">
            <Link2Icon className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 truncate font-mono text-sm">{paymentLink}</p>
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
            <p className="-mt-4 text-xs text-secondary-foreground">Link copied</p>
          ) : null}

          <PayQrCode paymentUrl={paymentUrl} />

          <Separator className="bg-border" />

          <div className="space-y-4">
            <p className="text-[0.6875rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Balances
            </p>
            <div className="flex flex-col gap-4">
              {balances.map((balance) => {
                const visual = balanceVisuals[balance.id] ?? {
                  iconClassName: "bg-secondary text-primary",
                  icon: balance.label.slice(0, 1),
                }

                return (
                  <div key={balance.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        visual.iconClassName
                      )}
                    >
                      {visual.icon}
                    </div>
                    <p className="min-w-0 flex-1 text-sm font-medium">{balance.label}</p>
                    <p className="shrink-0 font-mono text-sm tabular-nums">{balance.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 p-4">
          <DrawerClose
            render={
              <Button variant="outline" className="w-full rounded-lg">
                Close
              </Button>
            }
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function ScanQrProvider({
  children,
  paymentLink,
  balances,
}: {
  children: React.ReactNode
  paymentLink: string
  balances: ScanQrBalance[]
}) {
  const [open, setOpen] = React.useState(false)

  const value = React.useMemo(
    () => ({
      openScanQr: () => setOpen(true),
    }),
    []
  )

  return (
    <ScanQrContext.Provider value={value}>
      {children}
      <ScanQrDrawerPanel
        open={open}
        onOpenChange={setOpen}
        paymentLink={paymentLink}
        balances={balances}
      />
    </ScanQrContext.Provider>
  )
}

export function ScanQrNavIcon() {
  return <QrCodeIcon />
}
