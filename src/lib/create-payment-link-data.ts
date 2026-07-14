import { supportsOnChainPayment } from "@/lib/payment-contracts"
import { testnetsEnabled } from "@/lib/testnets"

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
  { id: "sol", label: "Solana", symbol: "SOL" },
]

const productionPaymentNetworks: PaymentNetwork[] = [
  { id: "base", label: "Base", tokenIds: ["usdc", "usdt", "eth"] },
  { id: "ethereum", label: "Ethereum", tokenIds: ["usdc", "usdt", "eth"] },
  { id: "arbitrum", label: "Arbitrum", tokenIds: ["usdc", "usdt", "eth"] },
  { id: "polygon", label: "Polygon", tokenIds: ["usdc", "usdt"] },
  { id: "solana", label: "Solana", tokenIds: ["usdc", "usdt", "sol"] },
]

const sepoliaPaymentNetwork: PaymentNetwork = {
  id: "sepolia",
  label: "Sepolia (testnet)",
  tokenIds: ["usdc", "usdt", "eth"],
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
