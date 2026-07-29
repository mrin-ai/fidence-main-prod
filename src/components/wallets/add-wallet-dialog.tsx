"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { XIcon } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount } from "wagmi";

import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { VerifyWalletButton } from "@/components/wallets/verify-wallet-button";
import { VerifySolanaWalletButton } from "@/components/wallets/verify-solana-wallet-button";
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
import { Input } from "@/components/ui/input";
import type { WalletNetworkId } from "@/lib/db/types";
import {
  getWalletNetworkById,
  getWalletNetworkIcon,
  walletNetworks,
} from "@/lib/wallet-networks";
import { cn } from "@/lib/utils";

type VerifiedWalletPayload = {
  id: string;
  networkId: string;
  networkLabel: string;
  address: string;
  label?: string;
  verifiedAt: string;
};

export function AddWalletDialog({
  open,
  onOpenChange,
  verifiedNetworkIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verifiedNetworkIds: string[];
  onAdded: (wallet: VerifiedWalletPayload) => void;
}) {
  const { address } = useAccount();
  const { connected: solanaConnected, disconnect: disconnectSolana } =
    useWallet();
  const [networkId, setNetworkId] = useState<WalletNetworkId | null>(null);
  const [label, setLabel] = useState("");

  const availableNetworks = useMemo(
    () =>
      walletNetworks.filter(
        (network) => !verifiedNetworkIds.includes(network.id),
      ),
    [verifiedNetworkIds],
  );

  const selectedNetwork = networkId ? getWalletNetworkById(networkId) : undefined;
  const isSolana = networkId === "solana";
  const networkLabel = selectedNetwork?.label ?? "network";
  const allNetworksVerified = availableNetworks.length === 0;

  useEffect(() => {
    if (!open) {
      setNetworkId(null);
      setLabel("");
    }
  }, [open]);

  function selectNetwork(id: WalletNetworkId) {
    setNetworkId((current) => {
      // Tap selected again to clear; tap another to switch.
      const next = current === id ? null : id;
      // Keep Phantom (Solana) and MetaMask (EVM) sessions separate.
      if (next && next !== "solana" && solanaConnected) {
        void disconnectSolana().catch(() => {
          // Ignore disconnect failures — EVM flow still uses MetaMask.
        });
      }
      return next;
    });
  }

  function handleVerified(wallet: VerifiedWalletPayload) {
    onAdded(wallet);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Add wallet</DialogTitle>
          <DialogDescription>
            {allNetworksVerified
              ? "You're all set across every supported network."
              : networkId
                ? "Tap × on the selected network to clear it, or pick another."
                : isSolana
                  ? "Connect Phantom to verify a Solana receiving address. This does not change how you sign in."
                  : "Pick a network, then sign. MetaMask will switch to that network before you confirm."}
          </DialogDescription>
        </DialogHeader>

        {allNetworksVerified ? (
          <>
            <EmptyStateLottie
              src="/animations/success.lottie"
              loop={false}
              title="All networks verified"
              description="Nothing left to add — every supported network already has a wallet."
              className="px-5 pb-2 pt-1"
              animationClassName="h-28 w-28"
            />
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
            <div className="space-y-4 px-5 pb-5">
              <div className="flex w-full flex-wrap justify-center gap-2">
                {availableNetworks.map((network) => {
                  const isSelected = network.id === networkId;
                  const iconSrc = getWalletNetworkIcon(network.id);

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
                      onClick={() =>
                        selectNetwork(network.id as WalletNetworkId)
                      }
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
                            network.id === "base" ? "size-3.5" : "size-[18px]",
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
                  );
                })}
              </div>

              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Label (optional)"
                className="h-9"
              />
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
                {networkId ? (
                  isSolana ? (
                    <VerifySolanaWalletButton
                      networkId={networkId}
                      label={label || undefined}
                      onVerified={handleVerified}
                      className="h-9 flex-1"
                      connectLabel="Connect Phantom"
                      verifyLabel={`Verify ${networkLabel}`}
                    />
                  ) : (
                    <VerifyWalletButton
                      networkId={networkId}
                      address={address ?? ""}
                      label={label || undefined}
                      onVerified={handleVerified}
                      className="h-9 flex-1"
                      connectLabel="Connect MetaMask"
                      verifyLabel={`Verify ${networkLabel}`}
                    />
                  )
                ) : (
                  <Button type="button" disabled className="h-9 flex-1">
                    Select a network
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
