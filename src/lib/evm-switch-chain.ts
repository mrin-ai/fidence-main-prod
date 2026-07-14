import {
  evmWalletNetworks,
  getEvmWalletNetworkByChainId,
} from "@/lib/evm-networks";
import { getChainIdForNetwork } from "@/lib/payment-contracts";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function getEthereumProvider() {
  if (typeof window === "undefined") return null;

  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider?.request ? provider : null;
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

function getChainConfig(chainId: number) {
  return (
    getEvmWalletNetworkByChainId(chainId)?.chain ??
    evmWalletNetworks.find((network) => network.chain.id === chainId)?.chain
  );
}

export async function switchWalletChain(chainId: number) {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("Wallet provider not found. Connect your wallet and try again.");
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
          rpcUrls: [...chain.rpcUrls.default.http],
          blockExplorerUrls: chain.blockExplorers?.default?.url
            ? [chain.blockExplorers.default.url]
            : undefined,
        },
      ],
    });
  }
}

export async function ensureWalletChain(
  requiredChainId: number,
  switchChainAsync?: (args: { chainId: number }) => Promise<unknown>,
) {
  try {
    if (switchChainAsync) {
      await switchChainAsync({ chainId: requiredChainId });
      return;
    }
  } catch (error) {
    if (!isConnectorChainMismatch(error) && !isUserRejected(error)) {
      throw error;
    }
    if (isUserRejected(error)) {
      throw new Error("Network switch cancelled.");
    }
  }

  await switchWalletChain(requiredChainId);
}

export async function switchWalletChainForNetwork(networkId: string) {
  const chainId = getChainIdForNetwork(networkId);
  if (chainId == null) {
    throw new Error("Unsupported network");
  }
  await switchWalletChain(chainId);
}
