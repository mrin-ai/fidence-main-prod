import { paymentNetworks, type PaymentNetwork } from "@/lib/create-payment-link-data";
import {
  evmWalletNetworks,
  getEvmNetworkIdForChainId,
  getEvmWalletNetworkByChainId,
  getEvmWalletNetworkById,
  isSupportedEvmWalletNetworkId,
} from "@/lib/evm-networks";

export type WalletNetwork = {
  id: string;
  label: string;
  testnet?: boolean;
  paymentEnabled: boolean;
};

const paymentNetworkIds = new Set(paymentNetworks.map((network) => network.id));

function toWalletNetwork(
  network: PaymentNetwork | (typeof evmWalletNetworks)[number],
): WalletNetwork {
  return {
    id: network.id,
    label: network.label,
    testnet: "testnet" in network ? network.testnet : undefined,
    paymentEnabled: paymentNetworkIds.has(network.id),
  };
}

/** All EVM networks users can verify a receiving wallet on. */
export const walletNetworks: WalletNetwork[] = [
  ...evmWalletNetworks.map(toWalletNetwork),
  {
    id: "solana",
    label: "Solana",
    paymentEnabled: paymentNetworkIds.has("solana"),
  },
];

export function getWalletNetworkById(id: string) {
  if (id === "solana") {
    return walletNetworks.find((network) => network.id === "solana");
  }
  const evm = getEvmWalletNetworkById(id);
  return evm ? toWalletNetwork(evm) : undefined;
}

export function getWalletNetworkByChainId(chainId: number) {
  const evm = getEvmWalletNetworkByChainId(chainId);
  if (evm) return toWalletNetwork(evm);

  const networkId = getEvmNetworkIdForChainId(chainId);
  if (networkId) return getWalletNetworkById(networkId);

  return undefined;
}

export function isSupportedWalletNetworkId(id: string) {
  return id === "solana" || isSupportedEvmWalletNetworkId(id);
}

export function getWalletNetworkLabel(id: string) {
  return (
    getWalletNetworkById(id)?.label ??
    (id === "sepolia" ? "Sepolia" : id)
  );
}

const networkIconById: Record<string, string> = {
  ethereum: "/networks/ethereum.svg",
  base: "/networks/base.svg",
  sepolia: "/networks/sepolia.svg",
  solana: "/networks/solana.svg",
};

export function getWalletNetworkIcon(id: string) {
  return networkIconById[id];
}
