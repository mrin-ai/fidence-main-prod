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
  tokenIds: ["usdc", "eth"],
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

export function getDefaultExpirationValue() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
