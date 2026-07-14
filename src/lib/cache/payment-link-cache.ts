import type { PublicPaymentLink } from "@/lib/payment-link-types";

import { cacheDel, cacheGet, cacheSet, parseStoredJson } from "@/lib/cache/redis";
import {
  CACHE_TTL,
  paymentLinkCacheKey,
} from "@/lib/cache/keys";

export async function getCachedPaymentLink(
  username: string,
  publicId: string,
) {
  const raw = await cacheGet(paymentLinkCacheKey(username, publicId));
  return parseStoredJson<PublicPaymentLink>(raw);
}

export async function setCachedPaymentLink(
  username: string,
  publicId: string,
  link: PublicPaymentLink,
) {
  await cacheSet(
    paymentLinkCacheKey(username, publicId),
    JSON.stringify(link),
    CACHE_TTL.paymentLinkSeconds,
  );
}

export async function invalidatePaymentLinkCache(
  username: string,
  publicId: string,
) {
  await cacheDel(paymentLinkCacheKey(username, publicId));
}
