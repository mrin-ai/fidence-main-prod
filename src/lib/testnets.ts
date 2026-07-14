/**
 * Sepolia testnet support.
 * Enabled by default so wallets, payment links, and checkout detect Sepolia.
 * Set NEXT_PUBLIC_ENABLE_TESTNETS=false to hide testnets in production.
 */
export function testnetsEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_TESTNETS !== "false";
}
