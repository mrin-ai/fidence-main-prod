"use client";

import { useCallback, useState } from "react";
import { createPublicClient, http, parseEther, parseUnits, type Chain } from "viem";
import { arbitrum, base, mainnet, polygon, sepolia } from "wagmi/chains";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import {
  erc20TransferAbi,
  getChainIdForNetwork,
  getTokenContract,
  supportsOnChainPayment,
} from "@/lib/payment-contracts";

const ERC20_TRANSFER_GAS_MAX = 200_000n;

const chainsByNetworkId: Record<string, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  polygon,
  sepolia,
};

function getNetworkPublicClient(networkId: string) {
  const chain = chainsByNetworkId[networkId];
  if (!chain) return null;

  return createPublicClient({
    chain,
    transport: http(),
  });
}

function formatOnchainError(
  error: unknown,
  input?: OnchainPaymentInput,
): string {
  if (!(error instanceof Error)) {
    return "Payment failed. Try again.";
  }

  const message = error.message;

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
    if (input?.networkId === "sepolia" && input.tokenId === "usdc") {
      return "Not enough USDC on Sepolia for this payment. Make sure your wallet holds the same test USDC token this app uses.";
    }
    return "Not enough token balance in your wallet for this payment.";
  }

  if (message.includes("gas limit too high")) {
    return "Transaction gas limit was rejected by the network. Check your wallet balance and try again.";
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
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
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
          await switchChainAsync({ chainId: requiredChainId });
        }

        const networkClient =
          getNetworkPublicClient(input.networkId) ?? publicClient;
        if (!networkClient) {
          throw new Error("Unable to connect to network");
        }

        let txHash: `0x${string}`;

        if (input.tokenId === "eth") {
          const value = parseEther(input.amount.toString());
          const gas = await networkClient.estimateGas({
            account: address,
            to: input.recipientAddress as `0x${string}`,
            value,
          });

          txHash = await sendTransactionAsync({
            to: input.recipientAddress as `0x${string}`,
            value,
            gas: gas + gas / 4n,
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

          const gas = await networkClient.estimateContractGas({
            address: token.address,
            abi: erc20TransferAbi,
            functionName: "transfer",
            args,
            account: address,
          });
          const gasLimit =
            gas + gas / 4n > ERC20_TRANSFER_GAS_MAX
              ? ERC20_TRANSFER_GAS_MAX
              : gas + gas / 4n;

          txHash = await writeContractAsync({
            address: token.address,
            abi: erc20TransferAbi,
            functionName: "transfer",
            args,
            gas: gasLimit,
          });
        }

        const receiptClient =
          getNetworkPublicClient(input.networkId) ?? publicClient;
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
    [
      address,
      chainId,
      publicClient,
      sendTransactionAsync,
      switchChainAsync,
      writeContractAsync,
    ],
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
