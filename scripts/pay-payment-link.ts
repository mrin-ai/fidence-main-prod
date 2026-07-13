/**
 * Pay a payment link on-chain and record it in Fidence.
 *
 * Wallet flow (MetaMask confirm):
 *   Open http://localhost:3000/pay-ritesh-agent.html
 *
 * CLI flow (requires funded Sepolia key):
 *   SEPOLIA_PRIVATE_KEY=0x... npx tsx scripts/pay-payment-link.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const USERNAME = "referealtest";
const LINK_ID = "16e9de654a5a";

const USDC_SEPOLIA = "0x3402d41AA8e34e0DF605c12109de2f8F4FF33A87" as const;

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function fetchLink() {
  const response = await fetch(`${BASE_URL}/api/pay/${USERNAME}/${LINK_ID}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load payment link");
  }
  return data as {
    status: string;
    amount: number;
    recipientAddress: string;
    tokenId: string;
    networkId: string;
    canPay: boolean;
  };
}

async function recordPayment(payerAddress: string, txHash: string) {
  const response = await fetch(`${BASE_URL}/api/pay/${USERNAME}/${LINK_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payerAddress, txHash }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to record payment");
  }
  return data;
}

async function payWithPrivateKey(privateKey: `0x${string}`) {
  const link = await fetchLink();

  if (link.status === "paid") {
    console.log("Link already paid.");
    return;
  }

  if (!link.canPay || !link.recipientAddress) {
    throw new Error("Payment link is not payable");
  }

  const account = privateKeyToAccount(privateKey);
  const transport = http();
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  console.log(`Paying ${link.amount} USDC from ${account.address}`);
  console.log(`Recipient: ${link.recipientAddress}`);

  const txHash = await walletClient.writeContract({
    address: USDC_SEPOLIA,
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [
      link.recipientAddress as `0x${string}`,
      parseUnits(link.amount.toString(), 6),
    ],
  });

  console.log("Tx sent:", txHash);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Tx confirmed.");

  const recorded = await recordPayment(account.address, txHash);
  console.log("Recorded in Fidence:", recorded.status, recorded.url);
}

async function pollUntilPaid(timeoutMs = 300_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const link = await fetchLink();
    if (link.status === "paid") {
      console.log("Payment recorded successfully.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("Timed out waiting for payment confirmation");
}

async function main() {
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}` | undefined;

  if (privateKey) {
    await payWithPrivateKey(privateKey);
    return;
  }

  console.log("No SEPOLIA_PRIVATE_KEY set.");
  console.log("Open this page in your browser and confirm in MetaMask:");
  console.log(`${BASE_URL}/pay-ritesh-agent.html`);
  console.log("\nWaiting for payment to complete...");
  await pollUntilPaid();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
