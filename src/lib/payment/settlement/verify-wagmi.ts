import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  http,
  parseUnits,
  type Hash,
} from "viem";

import { getEvmWalletNetworkById } from "@/lib/evm-networks";
import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getTokenContract } from "@/lib/payment-contracts";

import { isFormatOnlySettlementVerification } from "./mode";
import type { PaymentSettlementVerifier, SettlementIntent } from "./types";

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function normalizeEvmAddress(address: string) {
  return address.trim().toLowerCase();
}

function meetsMinimumAmount(actual: bigint, expected: number, decimals: number) {
  const expectedUnits = parseUnits(expected.toString(), decimals);
  const minimum = (expectedUnits * BigInt(99)) / BigInt(100);
  return actual >= minimum;
}

function createNetworkClient(networkId: string) {
  const network = getEvmWalletNetworkById(networkId);
  if (!network) return null;

  const rpcUrl = getEvmRpcUrl(networkId);
  return createPublicClient({
    chain: network.chain,
    transport: http(rpcUrl),
  });
}

async function verifyEvmOnChain(intent: SettlementIntent, txHash: string) {
  const client = createNetworkClient(intent.networkId);
  if (!client) return false;

  const hash = txHash as Hash;
  const recipient = normalizeEvmAddress(intent.recipientAddress);
  const payer = normalizeEvmAddress(intent.payerAddress);

  const receipt = await client.getTransactionReceipt({ hash });
  if (!receipt || receipt.status !== "success") return false;

  if (intent.tokenId === "eth") {
    const tx = await client.getTransaction({ hash });
    if (!tx?.to) return false;
    if (normalizeEvmAddress(tx.to) !== recipient) return false;
    if (normalizeEvmAddress(tx.from) !== payer) return false;
    return meetsMinimumAmount(tx.value, intent.amount, 18);
  }

  const token = getTokenContract(intent.networkId, intent.tokenId);
  if (!token) return false;

  const tokenAddress = normalizeEvmAddress(token.address);

  for (const log of receipt.logs) {
    if (normalizeEvmAddress(log.address) !== tokenAddress) continue;

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== "Transfer") continue;

      const { from, to, value } = decoded.args;
      if (normalizeEvmAddress(to) !== recipient) continue;
      if (normalizeEvmAddress(from) !== payer) continue;
      if (meetsMinimumAmount(value, intent.amount, token.decimals)) {
        return true;
      }
    } catch {
      // Ignore logs that are not ERC-20 Transfer events.
    }
  }

  return false;
}

export const wagmiSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(intent: SettlementIntent, txHash: string) {
    const normalized = txHash.trim();
    if (!TX_HASH_REGEX.test(normalized)) return false;

    if (isFormatOnlySettlementVerification()) {
      return true;
    }

    try {
      return await verifyEvmOnChain(intent, normalized);
    } catch {
      return false;
    }
  },
};
