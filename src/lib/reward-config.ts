/** Credits granted per successful referral signup. */
export const REFERRAL_CREDITS_PER_SIGNUP = 5;

/** Payment rewards accrue at 0.1% for both payers and recipients. */
export const PAYMENT_REWARD_RATE = 0.001;

export const PAYMENT_REWARD_ELIGIBLE_TYPES = [
  "payment_received",
  "profile_payment",
  "payment_sent",
] as const;

export type PaymentRewardEligibleType =
  (typeof PAYMENT_REWARD_ELIGIBLE_TYPES)[number];

const CREDIT_PRECISION = 1_000_000;

export function calculatePaymentRewardCredits(amount: number) {
  return (
    Math.round(amount * PAYMENT_REWARD_RATE * CREDIT_PRECISION) /
    CREDIT_PRECISION
  );
}

export function formatRewardCredits(credits: number) {
  if (credits === 0) return "0";

  const abs = Math.abs(credits);
  if (abs < 0.01) {
    return credits.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    });
  }

  if (abs < 1) {
    return credits.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return credits.toLocaleString("en-US", {
    minimumFractionDigits: credits % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 4,
  });
}

export function formatPaymentRewardRate(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}
