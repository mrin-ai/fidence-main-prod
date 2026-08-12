"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, isAddress, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { PayPageNavbar } from "@/components/pay/pay-page-navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTxExplorerUrl } from "@/lib/block-explorer";
import {
  PAYAGENT_ABI,
  PAYAGENT_TOKEN_ADDRESS,
  PAYAGENT_TOKEN_CHAIN,
  PAYAGENT_TOKEN_DECIMALS,
  PAYAGENT_TOKEN_SYMBOL,
} from "@/lib/payagent-token";
import {
  formatOracleUsdPrice,
  PAYAGENT_ORACLE_ABI,
  PAYAGENT_ORACLE_ADDRESS,
  tokenUsdValue,
} from "@/lib/payagent-oracle";
import { truncateAddress } from "@/lib/profile-url";

function formatTokenAmount(value?: bigint) {
  if (value === undefined) return "—";
  return `${formatUnits(value, PAYAGENT_TOKEN_DECIMALS)} ${PAYAGENT_TOKEN_SYMBOL}`;
}

export function FidenceTokenPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const handledTxHash = useRef<string | null>(null);

  const onSepolia = chainId === PAYAGENT_TOKEN_CHAIN.id;

  const {
    data: totalSupply,
    isLoading: isLoadingSupply,
    refetch: refetchTotalSupply,
  } = useReadContract({
    address: PAYAGENT_TOKEN_ADDRESS,
    abi: PAYAGENT_ABI,
    functionName: "totalSupply",
    chainId: PAYAGENT_TOKEN_CHAIN.id,
    query: { enabled: true },
  });

  const {
    data: walletBalance,
    isLoading: isLoadingBalance,
    refetch: refetchWalletBalance,
  } = useReadContract({
    address: PAYAGENT_TOKEN_ADDRESS,
    abi: PAYAGENT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: PAYAGENT_TOKEN_CHAIN.id,
    query: { enabled: Boolean(address) },
  });

  const { data: oraclePrice, isLoading: isLoadingOraclePrice } = useReadContract({
    address: PAYAGENT_ORACLE_ADDRESS,
    abi: PAYAGENT_ORACLE_ABI,
    functionName: "latestPrice",
    chainId: PAYAGENT_TOKEN_CHAIN.id,
  });

  const { writeContractAsync, isPending: isMinting } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      chainId: PAYAGENT_TOKEN_CHAIN.id,
    });

  useEffect(() => {
    if (!isConfirmed || !txHash || handledTxHash.current === txHash) return;

    handledTxHash.current = txHash;
    void refetchTotalSupply();
    void refetchWalletBalance();
    setMintSuccess(
      `Minted ${amount} ${PAYAGENT_TOKEN_SYMBOL} to ${truncateAddress(recipient, 4)}.`,
    );
  }, [
    isConfirmed,
    txHash,
    amount,
    recipient,
    refetchTotalSupply,
    refetchWalletBalance,
  ]);

  async function handleAddToWallet() {
    setWalletNotice(null);

    if (!walletClient) {
      setWalletNotice("Connect your wallet first.");
      return;
    }

    if (!onSepolia) {
      setWalletNotice("Switch to Sepolia before adding the token.");
      return;
    }

    try {
      const added = await walletClient.watchAsset({
        type: "ERC20",
        options: {
          address: PAYAGENT_TOKEN_ADDRESS,
          symbol: PAYAGENT_TOKEN_SYMBOL,
          decimals: PAYAGENT_TOKEN_DECIMALS,
        },
      });

      setWalletNotice(
        added
          ? "PAYAGENT added to your wallet. Check Tokens on Sepolia."
          : "Wallet did not add the token. Import it manually using the contract address below.",
      );
    } catch (error) {
      setWalletNotice(
        error instanceof Error
          ? error.message
          : "Could not add token to wallet. Import it manually.",
      );
    }
  }

  async function handleMint() {
    setMintError(null);
    setMintSuccess(null);
    setTxHash(null);
    handledTxHash.current = null;

    if (!isConnected || !address) {
      setMintError("Connect your wallet first.");
      return;
    }

    if (!onSepolia) {
      setMintError("Switch to Sepolia before minting.");
      return;
    }

    if (!recipient.trim() || !isAddress(recipient.trim())) {
      setMintError("Enter a valid recipient address.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setMintError("Enter a valid amount greater than zero.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: PAYAGENT_TOKEN_ADDRESS,
        abi: PAYAGENT_ABI,
        functionName: "mint",
        args: [recipient.trim() as `0x${string}`, parseUnits(amount, PAYAGENT_TOKEN_DECIMALS)],
        chainId: PAYAGENT_TOKEN_CHAIN.id,
      });

      setTxHash(hash);
    } catch (error) {
      setMintError(
        error instanceof Error ? error.message : "Mint transaction failed.",
      );
    }
  }

  const explorerUrl =
    txHash && getTxExplorerUrl("sepolia", txHash);

  let parsedPreview: string | null = null;
  if (amount.trim()) {
    try {
      parsedPreview = parseUnits(amount, PAYAGENT_TOKEN_DECIMALS).toString();
    } catch {
      parsedPreview = null;
    }
  }

  return (
    <div className="lcx-auth flex min-h-full flex-col bg-background">
      <PayPageNavbar />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              Fidence Token
            </h1>
            <p className="text-sm text-muted-foreground">
              Sepolia testnet · {PAYAGENT_TOKEN_DECIMALS} decimals
            </p>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>

        {!onSepolia && isConnected ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">
                Switch to Sepolia to read and mint PAYAGENT.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={isSwitchingChain}
                onClick={() => switchChain({ chainId: sepolia.id })}
              >
                Switch to Sepolia
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Oracle price</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {isLoadingOraclePrice ? "…" : formatOracleUsdPrice(oraclePrice) ?? "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                PAYAGENTOracle.latestPrice() · 8 decimals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Total supply</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {isLoadingSupply ? "…" : formatTokenAmount(totalSupply)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>My wallet balance</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {!isConnected
                  ? "Connect wallet"
                  : isLoadingBalance
                    ? "…"
                    : formatTokenAmount(walletBalance)}
              </CardTitle>
            </CardHeader>
            {isConnected && walletBalance !== undefined && oraclePrice !== undefined ? (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  ≈{" "}
                  {tokenUsdValue(
                    Number(formatUnits(walletBalance, PAYAGENT_TOKEN_DECIMALS)),
                    oraclePrice,
                  )}
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>

        {isConnected && walletBalance && walletBalance > BigInt(0) ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-primary">
                Your tokens are on-chain, but Rabby/MetaMask do not auto-show custom
                tokens. Add PAYAGENT manually on <strong>Sepolia</strong>.
              </p>
              <Button size="sm" variant="outline" onClick={() => void handleAddToWallet()}>
                Add PAYAGENT to wallet
              </Button>
              {walletNotice ? (
                <p className="text-xs text-muted-foreground">{walletNotice}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Manual import: Network Sepolia · Contract{" "}
                <span className="font-mono">{PAYAGENT_TOKEN_ADDRESS}</span> · Symbol
                PAYAGENT · Decimals 6
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mint tokens</CardTitle>
            <CardDescription>
              Requires MINTER_ROLE. Amount uses {PAYAGENT_TOKEN_DECIMALS} decimals
              (1000 → 1,000,000,000 on-chain).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient address</Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="1000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {parsedPreview ? (
                <p className="text-xs text-muted-foreground">
                  On-chain value: {parsedPreview}
                </p>
              ) : null}
            </div>

            <Button
              className="w-full"
              disabled={isMinting || isConfirming}
              onClick={() => void handleMint()}
            >
              {isMinting || isConfirming ? "Minting…" : "Mint"}
            </Button>

            {mintError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {mintError}
              </p>
            ) : null}

            {mintSuccess ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {mintSuccess}
              </p>
            ) : null}

            {txHash ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">Transaction hash</p>
                <p className="mt-1 break-all font-mono text-xs">{txHash}</p>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    View on Etherscan
                  </a>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contracts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground">PAYAGENT token (proxy)</p>
              <p className="break-all font-mono text-xs">{PAYAGENT_TOKEN_ADDRESS}</p>
              <a
                href={`https://sepolia.etherscan.io/address/${PAYAGENT_TOKEN_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-primary hover:underline"
              >
                View token on Etherscan
              </a>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">PAYAGENTOracle</p>
              <p className="break-all font-mono text-xs">{PAYAGENT_ORACLE_ADDRESS}</p>
              <a
                href={`https://sepolia.etherscan.io/address/${PAYAGENT_ORACLE_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-primary hover:underline"
              >
                View oracle on Etherscan
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
