export type SettingsUserProfile = {
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
}

export type SettingsUser = {
  name: string
  email?: string
  username?: string
  profile: SettingsUserProfile
  initials: string
  role: string
  plan: "free" | "enterprise"
  isProUser: boolean
  authMethod?: "google" | "wallet"
  walletAddress?: string
}
