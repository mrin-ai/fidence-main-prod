import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseEther,
  parseUnits,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, mainnet, sepolia } from "viem/chains";

import { erc20TransferAbi, getTokenContract } from "./contracts.js";
import type { LocalWallet } from "./wallet.js";

const chains: Record<string, Chain> = {
  sepolia,
  base,
  ethereum: mainnet,
};

function getRpcUrl(networkId: string) {
  const envSpecific = process.env[`FIDENCE_${networkId.toUpperCase()}_RPC_URL`]?.trim();
  if (envSpecific) return envSpecific;

  const envGeneric = process.env.FIDENCE_RPC_URL?.trim();
  if (envGeneric) return envGeneric;

  const defaults: Record<string, string> = {
    sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
    base: "https://mainnet.base.org",
    ethereum: "https://ethereum-rpc.publicnode.com",
  };

  const url = defaults[networkId];
  if (!url) {
    throw new Error(
      `No RPC URL for ${networkId}. Set FIDENCE_${networkId.toUpperCase()}_RPC_URL or FIDENCE_RPC_URL.`,
    );
  }
  return url;
}

function applyGasBuffer(estimated: bigint, cap: bigint) {
  const buffered = (estimated * BigInt(12)) / BigInt(10);
  return buffered > cap ? cap : buffered;
}

export async function sendLocalEvmPayment(input: {
  wallet: LocalWallet;
  networkId: string;
  tokenId: string;
  recipientAddress: string;
  amount: number;
}) {
  const chain = chains[input.networkId];
  if (!chain) {
    throw new Error(`Unsupported network: ${input.networkId}`);
  }

  const rpcUrl = getRpcUrl(input.networkId);
  const account = privateKeyToAccount(input.wallet.privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const recipient = getAddress(input.recipientAddress);
  const tokenId = input.tokenId.toLowerCase();

  let hash: `0x${string}`;

  if (tokenId === "eth") {
    const value = parseEther(input.amount.toString());
    const gas = applyGasBuffer(
      await publicClient.estimateGas({ account: account.address, to: recipient, value }),
      BigInt(50_000),
    );
    hash = await walletClient.sendTransaction({
      account,
      chain,
      to: recipient,
      value,
      gas,
    });
  } else {
    const token = getTokenContract(input.networkId, tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} is not configured on ${input.networkId}`);
    }

    const amount = parseUnits(input.amount.toString(), token.decimals);
    const simulation = await publicClient.simulateContract({
      account: account.address,
      address: token.address,
      abi: erc20TransferAbi,
      functionName: "transfer",
      args: [recipient, amount],
    });

    const gas = applyGasBuffer(simulation.request.gas ?? BigInt(100_000), BigInt(300_000));
    hash = await walletClient.writeContract({
      ...simulation.request,
      account,
      chain,
      gas,
    });
  }

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
