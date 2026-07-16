import { signMessage } from "@wagmi/core";
import type { Connector } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi-config";

/**
 * Sign an auth message using the live wallet connector.
 * Chain-agnostic — avoids stale wagmi session chain mismatches on sign-in.
 */
export async function signWalletMessage(
  connector: Connector | undefined,
  account: `0x${string}`,
  message: string,
) {
  if (!connector) {
    throw new Error("Wallet connector not available");
  }

  return signMessage(wagmiConfig, {
    account,
    connector,
    message,
  });
}
