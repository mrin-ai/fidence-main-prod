import { getPaymentBaseUrl } from "@/lib/payment-link-url";

const REFERRAL_CODE_REGEX = /^[A-Z0-9]{6,12}$/;

export function normalizeReferralCode(code: string) {
  return code.trim().toUpperCase();
}

export function isValidReferralCodeFormat(code: string) {
  return REFERRAL_CODE_REGEX.test(normalizeReferralCode(code));
}

export function buildReferralSignupUrl(referralCode: string) {
  const base = getPaymentBaseUrl();
  return `${base}/sign-up?ref=${encodeURIComponent(normalizeReferralCode(referralCode))}`;
}

export function parseReferralCookie(cookieHeader: string | null) {
  if (!cookieHeader) return undefined;

  const match = cookieHeader.match(/(?:^|;\s*)lcx-ref=([^;]*)/);
  if (!match?.[1]) return undefined;

  try {
    const value = decodeURIComponent(match[1]).trim();
    return value ? normalizeReferralCode(value) : undefined;
  } catch {
    return undefined;
  }
}
