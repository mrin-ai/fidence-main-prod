"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { getNetworkById } from "@/lib/create-payment-link-data";
import { truncateAddress } from "@/lib/profile-url";
import { AddWalletDialog } from "@/components/wallets/add-wallet-dialog";
import { WalletQrButton, WalletQrDialog } from "@/components/wallets/wallet-qr-dialog";
import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type WalletListItem = {
  id: string;
  networkId: string;
  address: string;
  label?: string;
  verifiedAt: string;
};

export function WalletList({
  wallets,
  username,
  sessionWallet,
  onWalletRemoved,
  onWalletAdded,
}: {
  wallets: WalletListItem[];
  username?: string | null;
  sessionWallet?: string | null;
  onWalletRemoved: (id: string) => void;
  onWalletAdded: (wallet: WalletListItem & { networkLabel?: string }) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [qrWallet, setQrWallet] = useState<WalletListItem | null>(null);

  const verifiedNetworkIds = wallets.map((wallet) => wallet.networkId);

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const response = await fetch(`/api/wallets/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to remove wallet");
      }
      onWalletRemoved(id);
      toast.success("Wallet removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove wallet");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Connected wallet</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionWallet ? (
            <p className="font-mono text-sm text-foreground">{sessionWallet}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No wallet connected to this session. Connect via sign-in or add a verified
              wallet below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Verified wallets</CardTitle>
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => setDialogOpen(true)}
            disabled={!username}
          >
            <PlusIcon className="size-4" />
            Add wallet
          </Button>
        </CardHeader>
        <CardContent>
          {!username ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/settings" className="font-medium text-primary hover:underline">
                Set a username in Settings
              </Link>{" "}
              before adding wallets.
            </p>
          ) : wallets.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <EmptyStateLottie
                title="No verified wallets yet"
                description="Add a wallet per network to receive payments on payment links and your public profile."
                animationClassName="h-28 w-28"
              />
              <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>
                <PlusIcon className="size-4" />
                Add your first wallet
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Network</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => {
                  const network = getNetworkById(wallet.networkId);
                  return (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-lg">
                          {network?.label ?? wallet.networkId}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {truncateAddress(wallet.address)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {wallet.label ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(wallet.verifiedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <WalletQrButton
                          onClick={() => {
                            setQrWallet(wallet);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={removingId === wallet.id}
                          onClick={() => void handleRemove(wallet.id)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WalletQrDialog
        wallet={qrWallet}
        open={qrWallet != null}
        onOpenChange={(open) => {
          if (!open) setQrWallet(null);
        }}
      />

      <AddWalletDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        verifiedNetworkIds={verifiedNetworkIds}
        onAdded={(wallet) =>
          onWalletAdded({
            id: wallet.id,
            networkId: wallet.networkId,
            address: wallet.address,
            label: wallet.label,
            verifiedAt: wallet.verifiedAt,
          })
        }
      />
    </div>
  );
}
