type RegisterWalletTokenInput = {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
};

type EthereumProvider = {
  request?: (args: { method: string; params: unknown }) => Promise<unknown>;
};

function getEthereumProvider() {
  if (typeof window === "undefined") return null;

  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider?.request ? provider : null;
}

/** Registers ERC-20 metadata in MetaMask so amounts show as e.g. 1 USDC, not 1000000. */
export async function tryRegisterWalletToken(
  input: RegisterWalletTokenInput & { cacheKey?: string },
) {
  const provider = getEthereumProvider();
  if (!provider?.request) return;

  if (input.cacheKey && typeof window !== "undefined") {
    const storageKey = `payagent:wallet-token:${input.cacheKey}`;
    if (window.sessionStorage.getItem(storageKey) === "1") {
      return;
    }
  }

  try {
    await provider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: input.address,
          symbol: input.symbol,
          decimals: input.decimals,
        },
      },
    });

    if (input.cacheKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(`payagent:wallet-token:${input.cacheKey}`, "1");
    }
  } catch {
    // User dismissed or the wallet does not support wallet_watchAsset.
  }
}

export function shouldShowMetamaskAtomicAmountHint(
  networkId: string,
  tokenId: string,
) {
  return networkId === "sepolia" && tokenId !== "eth";
}

export function formatAtomicTokenAmount(amount: number, decimals: number) {
  const atomic = Math.round(amount * 10 ** decimals);
  return atomic.toLocaleString("en-US");
}
