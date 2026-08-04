import { supportsOnChainPayment } from "@/lib/payment-contracts"
import { testnetsEnabled } from "@/lib/testnets"

/** LCX Token 2.0 — https://chain.lcx.com/token */
export const LCX_TOKEN_SYMBOL = "LCX"

export type PaymentToken = {
  id: string
  label: string
  symbol: string
}

export type PaymentNetwork = {
  id: string
  label: string
  tokenIds: string[]
  testnet?: boolean
}

export const paymentTokens: PaymentToken[] = [
  { id: "usdc", label: "USD Coin", symbol: "USDC" },
  { id: "usdt", label: "Tether", symbol: "USDT" },
  { id: "eth", label: "Ethereum", symbol: "ETH" },
  { id: "lcx", label: "LCX Token", symbol: LCX_TOKEN_SYMBOL },
  { id: "sol", label: "Solana", symbol: "SOL" },
]

const evmPaymentTokenIds = ["usdc", "usdt", "eth", "lcx"] as const

const productionPaymentNetworks: PaymentNetwork[] = [
  { id: "ethereum", label: "Ethereum", tokenIds: [...evmPaymentTokenIds] },
  { id: "base", label: "Base", tokenIds: [...evmPaymentTokenIds] },
  { id: "solana", label: "Solana", tokenIds: ["usdc", "usdt", "sol"] },
]

const sepoliaPaymentNetwork: PaymentNetwork = {
  id: "sepolia",
  label: "Sepolia",
  tokenIds: [...evmPaymentTokenIds],
  testnet: true,
}

export const paymentNetworks: PaymentNetwork[] = testnetsEnabled()
  ? [...productionPaymentNetworks, sepoliaPaymentNetwork]
  : productionPaymentNetworks

export function getTokenById(id: string) {
  return paymentTokens.find((token) => token.id === id)
}

export function getNetworkById(id: string) {
  return paymentNetworks.find((network) => network.id === id)
}

export function getNetworksForToken(tokenId: string) {
  return paymentNetworks.filter((network) => network.tokenIds.includes(tokenId))
}

export function getTokensForNetwork(networkId: string) {
  const network = getNetworkById(networkId)
  if (!network) return []

  return paymentTokens.filter(
    (token) =>
      network.tokenIds.includes(token.id) &&
      supportsOnChainPayment(networkId, token.id),
  )
}

export function isPaymentTokenNetworkSupported(
  tokenId: string,
  networkId: string,
) {
  const network = getNetworkById(networkId)
  if (!network?.tokenIds.includes(tokenId)) return false
  return supportsOnChainPayment(networkId, tokenId)
}

export function getSupportedPaymentTokens() {
  return paymentTokens.filter((token) =>
    paymentNetworks.some((network) =>
      isPaymentTokenNetworkSupported(token.id, network.id),
    ),
  )
}

export function getDefaultExpirationValue() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const tokenIconById: Record<string, string> = {
  usdc: "/tokens/usdc.svg",
  usdt: "/tokens/usdt.svg",
  eth: "/tokens/eth.svg",
  lcx: "/tokens/lcx.png",
  sol: "/tokens/sol.svg",
}

export function getPaymentTokenIcon(id: string) {
  return tokenIconById[id]
}

export function getPaymentTokenIconSize(tokenId: string) {
  if (tokenId === "eth") return 18
  if (tokenId === "lcx") return 22
  return 16
}

export function getPaymentTokenIconClassName(tokenId: string) {
  if (tokenId === "lcx") return "size-[22px] shrink-0 object-contain"
  if (tokenId === "eth") return "size-[18px] shrink-0 object-contain"
  return "size-4 shrink-0 object-contain"
}
