import { getPaymentBaseUrl } from "@/lib/payment-link-url";

export function buildProfilePath(username: string) {
  return `/${username.trim().toLowerCase()}`;
}

export function buildProfileUrl(username: string) {
  const base = getPaymentBaseUrl();
  return `${base}${buildProfilePath(username)}`;
}

export function truncateAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
