import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Hash,
} from "viem";

import { getEvmWalletNetworkById } from "@/lib/evm-networks";
import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getTokenContract } from "@/lib/payment-contracts";

import { isFormatOnlySettlementVerification } from "./mode";
import type {
  PaymentSettlementVerifier,
  SettlementIntent,
  SettlementVerifyResult,
} from "./types";

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function normalizeEvmAddress(address: string) {
  return address.trim().toLowerCase();
}

function meetsMinimumAmount(actual: bigint, expected: number, decimals: number) {
  const expectedUnits = parseUnits(expected.toString(), decimals);
  const minimum = (expectedUnits * BigInt(99)) / BigInt(100);
  return actual >= minimum;
}

function unitsToAmount(value: bigint, decimals: number) {
  return Number(formatUnits(value, decimals));
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

async function verifyEvmOnChainDetailed(
  intent: SettlementIntent,
  txHash: string,
): Promise<SettlementVerifyResult> {
  const client = createNetworkClient(intent.networkId);
  if (!client) return { ok: false };

  const hash = txHash as Hash;
  const recipient = normalizeEvmAddress(intent.recipientAddress);
  const payer = normalizeEvmAddress(intent.payerAddress);

  const receipt = await client.getTransactionReceipt({ hash });
  if (!receipt || receipt.status !== "success") return { ok: false };

  if (intent.tokenId === "eth") {
    const tx = await client.getTransaction({ hash });
    if (!tx?.to) return { ok: false };
    if (normalizeEvmAddress(tx.to) !== recipient) return { ok: false };
    if (normalizeEvmAddress(tx.from) !== payer) return { ok: false };
    if (!meetsMinimumAmount(tx.value, intent.amount, 18)) return { ok: false };
    return { ok: true, observedAmount: unitsToAmount(tx.value, 18) };
  }

  const token = getTokenContract(intent.networkId, intent.tokenId);
  if (!token) return { ok: false };

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
        return {
          ok: true,
          observedAmount: unitsToAmount(value, token.decimals),
        };
      }
    } catch {
      // Ignore logs that are not ERC-20 Transfer events.
    }
  }

  return { ok: false };
}

export const wagmiSettlementVerifier: PaymentSettlementVerifier = {
  async verifySettlement(intent: SettlementIntent, txHash: string) {
    const detailed = await this.verifySettlementDetailed(intent, txHash);
    return detailed.ok;
  },

  async verifySettlementDetailed(intent: SettlementIntent, txHash: string) {
    const normalized = txHash.trim();
    if (!TX_HASH_REGEX.test(normalized)) return { ok: false };

    if (isFormatOnlySettlementVerification()) {
      return { ok: true, observedAmount: intent.amount };
    }

    try {
      return await verifyEvmOnChainDetailed(intent, normalized);
    } catch {
      return { ok: false };
    }
  },
};
