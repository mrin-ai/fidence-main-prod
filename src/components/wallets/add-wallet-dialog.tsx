"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  SearchIcon,
  WalletIcon,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAccount } from "wagmi";

import { formatWalletVerifyPreview } from "@/lib/auth-session";
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
import { Label } from "@/components/ui/label";
import type { WalletNetworkId } from "@/lib/db/types";
import {
  getWalletNetworkByChainId,
  getWalletNetworkById,
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
  const { address, chainId } = useAccount();
  const { publicKey: solanaPublicKey, connected: solanaConnected } = useWallet();
  const [networkId, setNetworkId] = useState<WalletNetworkId>("ethereum");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");
  const userPickedNetworkRef = useRef(false);
  const selectedNetworkButtonRef = useRef<HTMLButtonElement>(null);

  const availableNetworks = useMemo(
    () =>
      walletNetworks.filter(
        (network) => !verifiedNetworkIds.includes(network.id),
      ),
    [verifiedNetworkIds],
  );

  const filteredNetworks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableNetworks;

    return availableNetworks.filter(
      (network) =>
        network.label.toLowerCase().includes(query) ||
        network.id.toLowerCase().includes(query),
    );
  }, [availableNetworks, search]);

  const selectedNetwork = getWalletNetworkById(networkId);
  const isSolana = networkId === "solana";
  const isConnected = isSolana ? solanaConnected : Boolean(address);
  const solanaAddress = solanaPublicKey?.toBase58();
  const connectedNetwork = chainId
    ? getWalletNetworkByChainId(chainId)
    : undefined;
  const verifyMessagePreview =
    !isSolana && isConnected && address
      ? formatWalletVerifyPreview(address, networkId)
      : null;

  const currentStep = isSolana
    ? !isConnected
      ? 1
      : 3
    : !isConnected
      ? 1
      : 3;

  useEffect(() => {
    if (!open) {
      userPickedNetworkRef.current = false;
      return;
    }

    setLabel("");
    setSearch("");

    if (availableNetworks.length === 0 || userPickedNetworkRef.current) {
      return;
    }

    const walletNetwork = chainId
      ? getWalletNetworkByChainId(chainId)
      : undefined;

    if (
      walletNetwork &&
      availableNetworks.some((network) => network.id === walletNetwork.id)
    ) {
      setNetworkId(walletNetwork.id);
      return;
    }

    setNetworkId((current) =>
      availableNetworks.some((network) => network.id === current)
        ? current
        : availableNetworks[0].id,
    );
  }, [open, availableNetworks, chainId]);

  useEffect(() => {
    if (!open) return;
    selectedNetworkButtonRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [networkId, open, filteredNetworks]);

  function selectNetwork(id: WalletNetworkId) {
    userPickedNetworkRef.current = true;
    setNetworkId(id);
  }

  function handleVerified(wallet: VerifiedWalletPayload) {
    onAdded(wallet);
    setLabel("");
    onOpenChange(false);
  }

  function useConnectedNetwork() {
    if (!connectedNetwork) return;
    if (verifiedNetworkIds.includes(connectedNetwork.id)) return;
    selectNetwork(connectedNetwork.id);
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
                Connect a wallet, pick a network, and sign to verify your
                address.
              </DialogDescription>
            </div>
          </div>

          {availableNetworks.length > 0 ? (
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
                {selectedNetwork ? (
                  <p className="text-sm font-medium">
                    {selectedNetwork.label}
                    {selectedNetwork.paymentEnabled ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        · Payments enabled
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search networks..."
                    className="h-9 pl-9"
                  />
                </div>

                {!isSolana &&
                isConnected &&
                connectedNetwork &&
                !verifiedNetworkIds.includes(connectedNetwork.id) &&
                connectedNetwork.id !== networkId ? (
                  <button
                    type="button"
                    onClick={useConnectedNetwork}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-primary/10"
                  >
                    <span className="text-muted-foreground">
                      Wallet is on{" "}
                      <span className="font-medium text-foreground">
                        {connectedNetwork.label}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-primary">Use this</span>
                  </button>
                ) : null}

                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 p-1">
                  {filteredNetworks.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No networks match your search.
                    </p>
                  ) : (
                    filteredNetworks.map((network) => {
                      const isSelected = network.id === networkId;
                      return (
                        <button
                          key={network.id}
                          ref={isSelected ? selectedNetworkButtonRef : undefined}
                          type="button"
                          onClick={() => selectNetwork(network.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-xs transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-muted/60",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {isSelected ? (
                              <CheckCircle2Icon className="size-3.5 shrink-0" />
                            ) : (
                              <span className="size-3.5 shrink-0" />
                            )}
                            <span className="font-medium">{network.label}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            {network.paymentEnabled ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "h-4 px-1.5 text-[10px] font-normal",
                                  isSelected && "bg-primary-foreground/15 text-primary-foreground",
                                )}
                              >
                                Payments
                              </Badge>
                            ) : null}
                            {network.testnet ? (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "h-4 px-1.5 text-[10px] font-normal",
                                  isSelected && "bg-primary-foreground/15 text-primary-foreground",
                                )}
                              >
                                Test
                              </Badge>
                            ) : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedNetwork?.testnet ? (
                  <p className="text-xs text-muted-foreground">
                    Use test ETH or USDC from a faucet — no real funds.
                  </p>
                ) : null}
                {!isSolana && isConnected ? (
                  <div className="space-y-3">
                    {address ? (
                      <p className="text-center font-mono text-xs text-muted-foreground">
                        {address}
                      </p>
                    ) : null}
                    {verifyMessagePreview ? (
                      <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
                        <p className="text-[11px] font-medium text-foreground">
                          You are verifying for{" "}
                          <span className="text-primary">
                            {selectedNetwork?.label ?? networkId}
                          </span>
                        </p>
                        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {verifyMessagePreview}
                        </pre>
                        {connectedNetwork &&
                        connectedNetwork.id !== networkId ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            MetaMask is on{" "}
                            <span className="font-medium">
                              {connectedNetwork.label}
                            </span>
                            . We&apos;ll ask to switch to{" "}
                            <span className="font-medium">
                              {selectedNetwork?.label ?? networkId}
                            </span>{" "}
                            before you sign, so the network in MetaMask matches
                            your selection.
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            MetaMask should show the same network at the top
                            and in the message before you confirm.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isSolana ? (
                !isConnected ? (
                  <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <WalletIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Connect Phantom</p>
                      <p className="text-xs text-muted-foreground">
                        Use the button below to connect your Solana wallet.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-center">
                    <p className="font-mono text-xs text-muted-foreground">
                      {solanaAddress}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      This is your Solana address — separate from the Ethereum
                      address used to sign in.
                    </p>
                  </div>
                )
              ) : !isConnected ? (
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <WalletIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Connect your wallet</p>
                    <p className="text-xs text-muted-foreground">
                      Use the button below to connect MetaMask or another wallet.
                    </p>
                  </div>
                </div>
              ) : null}

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
            </div>

            <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-24"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {isSolana ? (
                  <VerifySolanaWalletButton
                    networkId={networkId}
                    label={label || undefined}
                    onVerified={handleVerified}
                    className="sm:min-w-40 sm:flex-1"
                  />
                ) : (
                  <VerifyWalletButton
                    networkId={networkId}
                    address={address ?? ""}
                    label={label || undefined}
                    onVerified={handleVerified}
                    className="sm:min-w-40 sm:flex-1"
                  />
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
