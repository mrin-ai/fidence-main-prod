"use client";

import { useCallback, useState } from "react";
import { BaseError, createPublicClient, http, parseEther, parseUnits } from "viem";
import {
  useAccount,
  useSendTransaction,
  useWriteContract,
} from "wagmi";

import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getEvmWalletNetworkById } from "@/lib/evm-networks";
import {
  erc20TransferAbi,
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "@/lib/payment-contracts";
import { switchWalletChainForNetwork } from "@/lib/evm-switch-chain";

function getNetworkPublicClient(networkId: string) {
  const chain = getEvmWalletNetworkById(networkId)?.chain;
  if (!chain) return null;

  const rpcUrl = getEvmRpcUrl(networkId);
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
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
  const message = getErrorMessage(error);

  if (message.includes("User rejected") || message.includes("user rejected")) {
    return "Transaction cancelled.";
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

  if (message.includes("does not match the connection's chain")) {
    return "Wallet network is out of sync. Switch to the correct network in MetaMask, then try again.";
  }

  const revertMatch = message.match(
    /reverted with the following reason:\s*([\s\S]+?)(?:\n\n|Contract Call:|$)/,
  );
  if (revertMatch?.[1]) {
    return revertMatch[1].trim();
  }

  return message.length > 180
    ? "Payment failed. Check wallet balance and network, then try again."
    : message;
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
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const executePayment = useCallback(
    async (input: OnchainPaymentInput) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      if (!supportsOnChainPayment(input.networkId, input.tokenId)) {
        throw new Error("This token/network combination is not supported yet");
      }

      const requiredChainId = getChainIdForNetwork(input.networkId);
      if (requiredChainId == null) {
        throw new Error("Unsupported network");
      }

      setIsPaying(true);

      try {
        if (chainId !== requiredChainId) {
          await switchWalletChainForNetwork(input.networkId);
        }

        let txHash: `0x${string}`;

        if (input.tokenId === "eth") {
          const value = parseEther(input.amount.toString());

          txHash = await sendTransactionAsync({
            chainId: requiredChainId,
            to: input.recipientAddress as `0x${string}`,
            value,
          });
        } else {
          const token = getTokenContract(input.networkId, input.tokenId);
          if (!token) {
            throw new Error("Token contract not configured for this network");
          }

          const args = [
            input.recipientAddress as `0x${string}`,
            parseUnits(input.amount.toString(), token.decimals),
          ] as const;

          txHash = await writeContractAsync({
            chainId: requiredChainId,
            address: token.address,
            abi: erc20TransferAbi,
            functionName: "transfer",
            args,
          });
        }

        const receiptClient = getNetworkPublicClient(input.networkId);
        if (receiptClient) {
          await receiptClient.waitForTransactionReceipt({ hash: txHash });
        }

        return { txHash, payerAddress: address };
      } catch (error) {
        throw new Error(formatOnchainError(error, input));
      } finally {
        setIsPaying(false);
      }
    },
    [address, chainId, sendTransactionAsync, writeContractAsync],
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
