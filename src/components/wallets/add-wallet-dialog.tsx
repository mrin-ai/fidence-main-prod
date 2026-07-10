"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  WalletIcon,
} from "lucide-react";
import { useAccount } from "wagmi";

import { VerifyWalletButton } from "@/components/wallets/verify-wallet-button";
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
import { Label } from "@/components/ui/label";
import { getNetworkById, paymentNetworks } from "@/lib/create-payment-link-data";
import {
  getChainIdForNetwork,
  getNetworkIdForChainId,
} from "@/lib/payment-contracts";
import type { WalletNetworkId } from "@/lib/db/types";
import { truncateAddress } from "@/lib/profile-url";
import { cn } from "@/lib/utils";

type VerifiedWalletPayload = {
  id: string;
  networkId: string;
  networkLabel: string;
  address: string;
  label?: string;
  verifiedAt: string;
};

function NetworkStatusRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium",
          highlight ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

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
  const isSolana = networkId === "solana";
  const isConnected = Boolean(address);
  const networksAligned =
    isConnected && requiredChainId != null && chainId === requiredChainId;
  const needsNetworkSwitch =
    isConnected && requiredChainId != null && chainId !== requiredChainId;

  const currentStep = !isConnected ? 1 : networksAligned ? 3 : 2;

  useEffect(() => {
    if (!open) return;

    setLabel("");
    if (availableNetworks.length === 0) return;

    if (!availableNetworks.some((network) => network.id === networkId)) {
      setNetworkId(availableNetworks[0].id as WalletNetworkId);
    }
  }, [open, availableNetworks, networkId]);

  function handleVerified(wallet: VerifiedWalletPayload) {
    onAdded(wallet);
    setLabel("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-3 border-b border-border/50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletIcon className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base">Add wallet</DialogTitle>
              <DialogDescription className="text-pretty">
                Verify a wallet for each network you want to receive payments on.
              </DialogDescription>
            </div>
          </div>

          {!isSolana && availableNetworks.length > 0 ? (
            <div className="flex items-center gap-2 pt-1">
              {[
                { step: 1, label: "Connect" },
                { step: 2, label: "Network" },
                { step: 3, label: "Sign" },
              ].map((item, index) => (
                <div key={item.step} className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      currentStep >= item.step
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {currentStep > item.step ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : (
                      item.step
                    )}
                  </div>
                  <span
                    className={cn(
                      "truncate text-xs",
                      currentStep >= item.step
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  {index < 2 ? (
                    <div className="hidden h-px min-w-3 flex-1 bg-border sm:block" />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        {availableNetworks.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2Icon className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-medium">All networks covered</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You have verified wallets for every supported network.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground">Network</Label>
                <div className="flex flex-wrap gap-2">
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
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {network.label}
                        {network.testnet ? (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[10px] font-normal"
                          >
                            Test
                          </Badge>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {selectedNetwork?.testnet ? (
                  <p className="text-xs text-muted-foreground">
                    Use Sepolia test ETH or USDC from a faucet — no real funds.
                  </p>
                ) : null}
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
                  placeholder="e.g. Business, Treasury"
                  className="h-9"
                />
              </div>

              {isSolana ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
                  <p className="text-sm font-medium">Solana coming soon</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    EVM networks are available for verification today.
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3.5",
                    !isConnected && "border-dashed border-border/70 bg-muted/15",
                    needsNetworkSwitch &&
                      "border-amber-500/30 bg-amber-500/5",
                    networksAligned && "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  {!isConnected ? (
                    <div className="flex items-start gap-3">
                      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Wallet not connected</p>
                        <p className="text-xs text-muted-foreground">
                          Connect MetaMask or another wallet to continue.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Connected address
                        </p>
                        {networksAligned ? (
                          <Badge
                            variant="secondary"
                            className="h-5 gap-1 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-400"
                          >
                            <CheckCircle2Icon className="size-3" />
                            Ready
                          </Badge>
                        ) : null}
                      </div>
                      <p className="font-mono text-sm text-foreground">
                        {truncateAddress(address!, 8)}
                      </p>

                      <div className="flex items-center gap-2 rounded-lg bg-background/80 p-2.5">
                        <NetworkStatusRow
                          label="Receiving on"
                          value={selectedNetwork?.label ?? networkId}
                          highlight
                        />
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <NetworkStatusRow
                          label="Wallet on"
                          value={
                            connectedNetwork?.label ??
                            (chainId ? `Chain ${chainId}` : "Unknown")
                          }
                          highlight={networksAligned}
                        />
                      </div>

                      {needsNetworkSwitch ? (
                        <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                          Your wallet must be on{" "}
                          <span className="font-medium">
                            {selectedNetwork?.label}
                          </span>{" "}
                          before you sign. The button below will switch networks
                          for you.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Sign a short message to prove you own this address. No
                          transaction or gas spent for verification.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
              {!isSolana ? (
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
                    className="sm:min-w-40 sm:flex-1"
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:ml-auto sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
