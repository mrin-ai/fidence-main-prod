import { createWalletClient, custom, type Chain } from "viem";

import {
  evmWalletNetworks,
  getEvmNetworkIdForChainId,
  getEvmWalletNetworkByChainId,
} from "@/lib/evm-networks";
import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getChainIdForNetwork } from "@/lib/payment-contracts";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  providers?: EthereumProvider[];
};

function listInjectedEthereumProviders(): EthereumProvider[] {
  if (typeof window === "undefined") return [];

  const ethereum = (
    window as Window & { ethereum?: EthereumProvider }
  ).ethereum;
  if (!ethereum) return [];

  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return ethereum.providers.filter((provider: EthereumProvider) =>
      Boolean(provider?.request),
    );
  }

  return ethereum.request ? [ethereum] : [];
}

function isPhantomProvider(provider: EthereumProvider) {
  return Boolean(provider.isPhantom);
}

function isMetaMaskProvider(provider: EthereumProvider) {
  // Phantom may also set isMetaMask for compatibility — exclude it.
  return Boolean(provider.isMetaMask) && !isPhantomProvider(provider);
}

/**
 * EVM provider for payments / wallet verify.
 * Prefers MetaMask and never returns Phantom (Solana uses the Solana adapter).
 */
export function getEthereumProvider() {
  const providers = listInjectedEthereumProviders();
  if (providers.length === 0) return null;

  const metamask = providers.find(isMetaMaskProvider);
  if (metamask) return metamask;

  const nonPhantom = providers.find((provider) => !isPhantomProvider(provider));
  if (nonPhantom) return nonPhantom;

  return null;
}

export function hasMetaMaskProvider() {
  return listInjectedEthereumProviders().some(isMetaMaskProvider);
}

function isUserRejected(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("user rejected") || message.includes("user denied");
}

function isUnknownChainError(error: unknown) {
  const code = (error as { code?: number })?.code;
  return code === 4902;
}

export function isConnectorChainMismatch(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("does not match the connection's chain")
  );
}

function getChainConfig(chainId: number): Chain | undefined {
  return (
    getEvmWalletNetworkByChainId(chainId)?.chain ??
    evmWalletNetworks.find((network) => network.chain.id === chainId)?.chain
  );
}

function getRpcUrlsForChain(chainId: number, chain: Chain) {
  const networkId = getEvmNetworkIdForChainId(chainId);
  const customRpc = networkId ? getEvmRpcUrl(networkId) : undefined;
  if (customRpc) return [customRpc];
  return [...chain.rpcUrls.default.http];
}

export async function getProviderChainId(provider = getEthereumProvider()) {
  if (!provider) return null;

  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(chainIdHex, 16);
}

export async function switchWalletChain(chainId: number) {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error(
      "MetaMask not found. Install or unlock MetaMask for EVM networks. Use Phantom only for Solana.",
    );
  }

  const chainIdHex = `0x${chainId.toString(16)}` as `0x${string}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    if (isUserRejected(error)) {
      throw new Error("Network switch cancelled.");
    }

    if (!isUnknownChainError(error)) {
      throw error instanceof Error
        ? error
        : new Error("Failed to switch network in wallet.");
    }

    const chain = getChainConfig(chainId);
    if (!chain) {
      throw new Error("This network is not configured in PayAgent.");
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: getRpcUrlsForChain(chainId, chain),
          blockExplorerUrls: chain.blockExplorers?.default?.url
            ? [chain.blockExplorers.default.url]
            : undefined,
        },
      ],
    });

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  }
}

export async function ensureProviderOnChain(chainId: number) {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error(
      "MetaMask not found. Install or unlock MetaMask for EVM networks. Use Phantom only for Solana.",
    );
  }

  // Ensure MetaMask is the active account source before switch/sign.
  await provider.request({ method: "eth_requestAccounts" }).catch(() => {
    // Some wallets throw if already authorized — continue to chain switch.
  });

  const currentChainId = await getProviderChainId(provider);
  if (currentChainId === chainId) {
    return;
  }

  await switchWalletChain(chainId);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nextChainId = await getProviderChainId(provider);
    if (nextChainId === chainId) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    "MetaMask did not switch networks in time. Open MetaMask, switch manually, then try again.",
  );
}

export function createPaymentWalletClient(input: {
  account: `0x${string}`;
  chainId: number;
}) {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error(
      "MetaMask not found. Install or unlock MetaMask for EVM networks. Use Phantom only for Solana.",
    );
  }

  const chain = getChainConfig(input.chainId);
  if (!chain) {
    throw new Error("This network is not configured in PayAgent.");
  }

  return createWalletClient({
    account: input.account,
    chain,
    transport: custom(provider),
  });
}

export async function ensureWalletChain(
  requiredChainId: number,
  switchChainAsync?: (args: { chainId: number }) => Promise<unknown>,
) {
  try {
    if (switchChainAsync) {
      await switchChainAsync({ chainId: requiredChainId });
    }
  } catch (error) {
    if (!isConnectorChainMismatch(error) && !isUserRejected(error)) {
      throw error;
    }
    if (isUserRejected(error)) {
      throw new Error("Network switch cancelled.");
    }
  }

  await ensureProviderOnChain(requiredChainId);
}

export async function switchWalletChainForNetwork(networkId: string) {
  const chainId = getChainIdForNetwork(networkId);
  if (chainId == null) {
    throw new Error("Unsupported network");
  }
  await ensureProviderOnChain(chainId);
}
