"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { getNetworkById, paymentNetworks } from "@/lib/create-payment-link-data";
import { truncateAddress } from "@/lib/profile-url";
import {
  getChainIdForNetwork,
  getNetworkIdForChainId,
} from "@/lib/payment-contracts";
import { VerifyWalletButton } from "@/components/wallets/verify-wallet-button";
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
import { Label } from "@/components/ui/label";
import type { WalletNetworkId } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export function AddWalletDialog({
  open,
  onOpenChange,
  verifiedNetworkIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verifiedNetworkIds: string[];
  onAdded: (wallet: {
    id: string;
    networkId: string;
    networkLabel: string;
    address: string;
    label?: string;
    verifiedAt: string;
  }) => void;
}) {
  const { address, chainId } = useAccount();
  const [networkId, setNetworkId] = useState<WalletNetworkId>("base");
  const [label, setLabel] = useState("");

  const availableNetworks = useMemo(
    () =>
      paymentNetworks.filter(
        (network) => !verifiedNetworkIds.includes(network.id),
      ),
    [verifiedNetworkIds],
  );

  const selectedNetwork = getNetworkById(networkId);
  const requiredChainId = getChainIdForNetwork(networkId);
  const connectedNetworkId = chainId
    ? getNetworkIdForChainId(chainId)
    : undefined;
  const connectedNetwork = connectedNetworkId
    ? getNetworkById(connectedNetworkId)
    : undefined;
  const needsNetworkSwitch =
    Boolean(address) &&
    requiredChainId != null &&
    chainId !== requiredChainId;

  const isSolana = networkId === "solana";

  useEffect(() => {
    if (!open) return;

    setLabel("");
    if (availableNetworks.length === 0) return;

    if (!availableNetworks.some((network) => network.id === networkId)) {
      setNetworkId(availableNetworks[0].id as WalletNetworkId);
    }
  }, [open, availableNetworks, networkId]);

  function handleVerified(wallet: {
    id: string;
    networkId: string;
    networkLabel: string;
    address: string;
    label?: string;
    verifiedAt: string;
  }) {
    onAdded(wallet);
    setLabel("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="border-b border-border/50 pb-4">
          <DialogTitle>Add wallet</DialogTitle>
          <DialogDescription>
            Pick a network and sign to verify ownership.
          </DialogDescription>
        </DialogHeader>

        {availableNetworks.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            You have verified wallets for all supported networks.
          </div>
        ) : (
          <>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground">Network</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableNetworks.map((network) => {
                    const isSelected = network.id === networkId;
                    return (
                      <button
                        key={network.id}
                        type="button"
                        onClick={() =>
                          setNetworkId(network.id as WalletNetworkId)
                        }
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                          isSelected
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {network.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet-label" className="text-xs text-muted-foreground">
                  Label{" "}
                  <span className="font-normal text-muted-foreground/70">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="wallet-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Business, personal..."
                  className="h-9"
                />
              </div>

              {isSolana ? (
                <p className="text-center text-xs text-amber-700">
                  Solana verification is coming soon.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-center">
                    <p className="text-[11px] text-muted-foreground">Connected wallet</p>
                    <p className="mt-0.5 font-mono text-xs text-foreground">
                      {address
                        ? truncateAddress(address, 6)
                        : "Connect your wallet to continue"}
                    </p>
                    {address && connectedNetwork ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Wallet network: {connectedNetwork.label}
                      </p>
                    ) : null}
                  </div>
                  {needsNetworkSwitch ? (
                    <p className="text-center text-xs text-amber-700">
                      Switch to {selectedNetwork?.label} before signing.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {!isSolana ? (
              <DialogFooter className="border-t border-border/50 bg-muted/20">
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:min-w-24"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <VerifyWalletButton
                    networkId={networkId}
                    address={address ?? ""}
                    label={label || undefined}
                    onVerified={handleVerified}
                    disabled={!address}
                    className="sm:min-w-36 sm:w-auto"
                  />
                </div>
              </DialogFooter>
            ) : (
              <DialogFooter className="border-t border-border/50 bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:ml-auto sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        <p className="border-t border-border/40 px-6 py-3 text-center text-[11px] text-muted-foreground/70">
          powered by{" "}
          <Link
            href="/"
            className="font-semibold text-primary hover:underline"
          >
            fidence
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
