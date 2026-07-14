export const CACHE_TTL = {
  paymentLinkSeconds: 45,
  merchantContextSeconds: 300,
  apiKeyResolveSeconds: 300,
} as const;

export function paymentLinkCacheKey(username: string, publicId: string) {
  return `pay:link:${username.trim().toLowerCase()}:${publicId}`;
}

export function merchantContextCacheKey(keyHash: string) {
  return `merchant:ctx:${keyHash}`;
}

export const SECURITY_AUDIT_QUEUE_KEY = "security:audit:queue";
