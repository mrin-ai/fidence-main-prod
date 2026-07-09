"use client";

import { QrCodeIcon } from "lucide-react";

import { getNetworkById } from "@/lib/create-payment-link-data";
import { buildWalletReceiveUri } from "@/lib/payment/erc681";
import { truncateAddress } from "@/lib/profile-url";
import { PaymentQrCode } from "@/components/payment/payment-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { WalletListItem } from "@/components/wallets/wallet-list";

export function WalletQrDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: WalletListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!wallet) return null;

  const network = getNetworkById(wallet.networkId);
  const qrValue = buildWalletReceiveUri({
    networkId: wallet.networkId,
    recipientAddress: wallet.address,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b border-border/50 pb-4">
          <DialogTitle>Scan to pay</DialogTitle>
          <DialogDescription>
            {network?.label ?? wallet.networkId} ·{" "}
            {truncateAddress(wallet.address, 6)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <PaymentQrCode value={qrValue} />
          <p className="text-center font-mono text-xs text-muted-foreground">
            {wallet.address}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WalletQrButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-foreground"
      aria-label="Show QR code"
      onClick={onClick}
    >
      <QrCodeIcon className="size-4" />
    </Button>
  );
}
