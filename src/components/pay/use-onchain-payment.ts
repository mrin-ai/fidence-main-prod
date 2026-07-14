"use client";

import { useCallback, useState } from "react";
import {
  BaseError,
  createPublicClient,
  http,
  type PublicClient,
} from "viem";
import { useAccount } from "wagmi";

import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getEvmWalletNetworkById } from "@/lib/evm-networks";
import {
  sendEvmNativePayment,
  sendEvmTokenPayment,
} from "@/lib/evm-wallet-payment";
import {
  createPaymentWalletClient,
  switchWalletChainForNetwork,
} from "@/lib/evm-switch-chain";
import {
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "@/lib/payment-contracts";

function getNetworkPublicClient(networkId: string) {
  const chain = getEvmWalletNetworkById(networkId)?.chain;
  if (!chain) return null;

  const rpcUrl = getEvmRpcUrl(networkId);
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

function collectErrorMessages(error: unknown) {
  const messages: string[] = [];
  const seen = new Set<unknown>();

  function walk(value: unknown) {
    if (value == null || seen.has(value)) return;
    seen.add(value);

    if (value instanceof Error) {
      if (value.message) messages.push(value.message);
      walk(value.cause);
      return;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.message === "string") {
        messages.push(record.message);
      }
      if (typeof record.shortMessage === "string") {
        messages.push(record.shortMessage);
      }
      if (typeof record.details === "string") {
        messages.push(record.details);
      }
      if (record.data && typeof record.data === "object") {
        walk(record.data);
      }
      if (record.cause) {
        walk(record.cause);
      }
    }
  }

  walk(error);
  return messages;
}

function getErrorMessage(error: unknown) {
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Payment failed. Try again.";
}

function formatOnchainError(
  error: unknown,
  input?: OnchainPaymentInput,
): string {
  const messages = collectErrorMessages(error);
  const message = messages.join(" ");

  if (message.includes("User rejected") || message.includes("user rejected")) {
    return "Transaction cancelled.";
  }

  if (
    message.includes("Not enough native token in your wallet to pay gas fees")
  ) {
    return "Not enough native token in your wallet to pay gas fees.";
  }

  if (message.includes("Not enough ") && message.includes(" balance at ")) {
    return messages.find((entry) => entry.startsWith("Not enough ")) ?? message;
  }

  if (message.includes("insufficient funds")) {
    return "Not enough native token in your wallet to pay gas fees.";
  }

  if (
    message.includes("insufficient") ||
    message.includes("exceeds balance") ||
    message.includes("ERC20: transfer amount exceeds balance")
  ) {
    if (
      input?.networkId === "sepolia" &&
      (input.tokenId === "usdc" || input.tokenId === "usdt")
    ) {
      return "Not enough token balance on Sepolia for this payment. Make sure your wallet holds the same test token this app uses.";
    }
    return "Not enough token balance in your wallet for this payment.";
  }

  if (message.includes("Network switch cancelled")) {
    return "Network switch cancelled.";
  }

  if (message.includes("gas limit too high")) {
    if (
      input?.networkId === "sepolia" &&
      (input.tokenId === "usdc" || input.tokenId === "usdt")
    ) {
      return "Transaction could not be sent. Make sure your wallet has enough Sepolia ETH for gas and enough of the test token you're paying with.";
    }
    return "Transaction could not be sent. Check wallet balance and network, then try again.";
  }

  if (
    message.includes("InvalidAddressError") ||
    (message.includes("Address") && message.includes("is invalid"))
  ) {
    return "The recipient wallet address on this payment link is invalid.";
  }

  const revertMatch = message.match(
    /reverted with the following reason:\s*([\s\S]+?)(?:\n\n|Contract Call:|$)/,
  );
  if (revertMatch?.[1]) {
    return revertMatch[1].trim();
  }

  const shortMessage = getErrorMessage(error);
  return shortMessage.length > 220
    ? "Payment failed. Check wallet balance and network, then try again."
    : shortMessage;
}

export type OnchainPaymentInput = {
  recipientAddress: string;
  amount: number;
  tokenId: string;
  networkId: string;
};

export function useOnchainPayment() {
  const [isPaying, setIsPaying] = useState(false);
  const { address, isConnected, chainId } = useAccount();

  const executePayment = useCallback(
    async (input: OnchainPaymentInput) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      if (!supportsOnChainPayment(input.networkId, input.tokenId)) {
        throw new Error("This token/network combination is not supported yet");
      }

      const network = getEvmWalletNetworkById(input.networkId);
      const requiredChainId = getChainIdForNetwork(input.networkId);
      if (requiredChainId == null || !network) {
        throw new Error("Unsupported network");
      }

      setIsPaying(true);

      try {
        await switchWalletChainForNetwork(input.networkId);

        const publicClient = getNetworkPublicClient(input.networkId);
        if (!publicClient) {
          throw new Error("This network is not configured in PayAgent.");
        }

        const walletClient = createPaymentWalletClient({
          account: address,
          chainId: requiredChainId,
        });

        let txHash: `0x${string}`;

        if (input.tokenId === "eth") {
          txHash = await sendEvmNativePayment({
            publicClient: publicClient as PublicClient,
            walletClient,
            chain: network.chain,
            from: address,
            recipientAddress: input.recipientAddress,
            amount: input.amount,
          });
        } else {
          const token = getTokenContract(input.networkId, input.tokenId);
          if (!token) {
            throw new Error("Token contract not configured for this network");
          }

          txHash = await sendEvmTokenPayment({
            publicClient: publicClient as PublicClient,
            walletClient,
            chain: network.chain,
            from: address,
            recipientAddress: input.recipientAddress,
            amount: input.amount,
            tokenAddress: token.address,
            tokenDecimals: token.decimals,
            tokenLabel: input.tokenId.toUpperCase(),
          });
        }

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        return { txHash, payerAddress: address };
      } catch (error) {
        throw new Error(formatOnchainError(error, input));
      } finally {
        setIsPaying(false);
      }
    },
    [address],
  );

  return {
    address,
    isConnected,
    chainId,
    isPaying,
    executePayment,
    getRequiredChainId: getChainIdForNetwork,
  };
}
