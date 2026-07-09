"use client";

import { useCallback, useState } from "react";
import { parseEther, parseUnits } from "viem";
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

        let txHash: `0x${string}`;

        if (input.tokenId === "eth") {
          txHash = await sendTransactionAsync({
            to: input.recipientAddress as `0x${string}`,
            value: parseEther(input.amount.toString()),
          });
        } else {
          const token = getTokenContract(input.networkId, input.tokenId);
          if (!token) {
            throw new Error("Token contract not configured for this network");
          }

          txHash = await writeContractAsync({
            address: token.address,
            abi: erc20TransferAbi,
            functionName: "transfer",
            args: [
              input.recipientAddress as `0x${string}`,
              parseUnits(input.amount.toString(), token.decimals),
            ],
          });
        }

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        return { txHash, payerAddress: address };
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
