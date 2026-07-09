import { parseEther, parseUnits } from "viem";

import { getChainIdForNetwork, getTokenContract } from "@/lib/payment-contracts";

export function buildWalletReceiveUri(input: {
  networkId: string;
  recipientAddress: string;
}) {
  const chainId = getChainIdForNetwork(input.networkId);
  if (!chainId) {
    return input.recipientAddress;
  }

  return `ethereum:${input.recipientAddress}@${chainId}`;
}

export function buildErc681Uri(input: {
  networkId: string;
  tokenId: string;
  recipientAddress: string;
  amount?: number;
}) {
  const chainId = getChainIdForNetwork(input.networkId);
  if (!chainId) {
    throw new Error(`Unsupported network: ${input.networkId}`);
  }

  const recipient = input.recipientAddress;

  if (input.tokenId === "eth") {
    const base = `ethereum:${recipient}@${chainId}`;
    if (input.amount == null || input.amount <= 0) {
      return base;
    }
    const wei = parseEther(input.amount.toString()).toString();
    return `${base}?value=${wei}`;
  }

  const token = getTokenContract(input.networkId, input.tokenId);
  if (!token) {
    throw new Error(`Token ${input.tokenId} not configured for ${input.networkId}`);
  }

  if (input.amount == null || input.amount <= 0) {
    return `ethereum:${token.address}@${chainId}`;
  }

  const atomicAmount = parseUnits(input.amount.toString(), token.decimals).toString();
  return `ethereum:${token.address}@${chainId}/transfer?address=${recipient}&uint256=${atomicAmount}`;
}
