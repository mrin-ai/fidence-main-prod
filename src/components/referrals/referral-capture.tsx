"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth-session";
import { normalizeReferralCode } from "@/lib/referrals";

export function ReferralCapture() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (!ref?.trim()) return;

    const code = normalizeReferralCode(ref);
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, [ref]);

  return null;
}

function getReferralCodeFromCookie() {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie.match(/(?:^|;\s*)lcx-ref=([^;]*)/);
  if (!match?.[1]) return undefined;

  try {
    return normalizeReferralCode(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}

export function getClientReferralCode(searchParams: URLSearchParams) {
  const fromUrl = searchParams.get("ref")?.trim();
  if (fromUrl) return normalizeReferralCode(fromUrl);
  return getReferralCodeFromCookie();
}
