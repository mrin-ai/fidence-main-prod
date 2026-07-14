import {
  erc20Abi,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
  type Abi,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";

import { erc20TransferAbi } from "@/lib/payment-contracts";

function applyGasBuffer(estimated: bigint, cap: bigint) {
  const buffered = (estimated * BigInt(12)) / BigInt(10);
  return buffered > cap ? cap : buffered;
}

async function assertHasGasBalance(
  publicClient: PublicClient,
  from: `0x${string}`,
) {
  const ethBalance = await publicClient.getBalance({ address: from });
  if (ethBalance === BigInt(0)) {
    throw new Error(
      "Not enough native token in your wallet to pay gas fees.",
    );
  }
}

async function assertHasTokenBalance(input: {
  publicClient: PublicClient;
  from: `0x${string}`;
  tokenAddress: `0x${string}`;
  amount: bigint;
  tokenDecimals: number;
  tokenLabel?: string;
}) {
  const balance = await input.publicClient.readContract({
    address: input.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [input.from],
  });

  if (balance < input.amount) {
    const have = formatUnits(balance, input.tokenDecimals);
    const need = formatUnits(input.amount, input.tokenDecimals);
    const label = input.tokenLabel ?? "token";
    throw new Error(
      `Not enough ${label} balance at ${input.tokenAddress}. Your wallet has ${have} but this payment needs ${need}.`,
    );
  }
}

export async function sendEvmNativePayment(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  chain: Chain;
  from: `0x${string}`;
  recipientAddress: string;
  amount: number;
}) {
  const recipientAddress = getAddress(input.recipientAddress);
  const value = parseEther(input.amount.toString());

  await assertHasGasBalance(input.publicClient, input.from);

  const gas = applyGasBuffer(
    await input.publicClient.estimateGas({
      account: input.from,
      to: recipientAddress,
      value,
    }),
    BigInt(50_000),
  );

  return input.walletClient.sendTransaction({
    account: input.from,
    chain: input.chain,
    to: recipientAddress,
    value,
    gas,
  });
}

export async function sendEvmTokenPayment(input: {
  publicClient: PublicClient;
  walletClient: WalletClient;
  chain: Chain;
  from: `0x${string}`;
  recipientAddress: string;
  amount: number;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  tokenLabel?: string;
}) {
  const recipientAddress = getAddress(input.recipientAddress);
  const tokenAddress = getAddress(input.tokenAddress);
  const amount = parseUnits(input.amount.toString(), input.tokenDecimals);

  await assertHasGasBalance(input.publicClient, input.from);
  await assertHasTokenBalance({
    publicClient: input.publicClient,
    from: input.from,
    tokenAddress,
    amount,
    tokenDecimals: input.tokenDecimals,
    tokenLabel: input.tokenLabel,
  });

  const simulation = await input.publicClient.simulateContract({
    account: input.from,
    address: tokenAddress,
    abi: erc20TransferAbi as Abi,
    functionName: "transfer",
    args: [recipientAddress, amount],
  });

  const gas = applyGasBuffer(
    simulation.request.gas ?? BigInt(100_000),
    BigInt(300_000),
  );

  return input.walletClient.writeContract({
    ...simulation.request,
    account: input.from,
    chain: input.chain,
    gas,
  });
}
