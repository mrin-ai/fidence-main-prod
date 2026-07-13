import type { ObjectId } from "mongodb";

import {
  calculatePaymentRewardCredits,
  PAYMENT_REWARD_ELIGIBLE_TYPES,
  PAYMENT_REWARD_RATE,
  REFERRAL_CREDITS_PER_SIGNUP,
  type PaymentRewardEligibleType,
} from "@/lib/reward-config";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { TransactionDoc } from "@/lib/db/types";
import { formatPaymentDateTime } from "@/lib/format-date";
import { getReferralOverview, type ReferralListItem } from "@/lib/db/referrals";

export type ReferralRewardItem = ReferralListItem & {
  credits: number;
};

export type PaymentRewardItem = {
  id: string;
  label: string;
  amount: number;
  symbol: string;
  credits: number;
  dateLabel: string;
  type: PaymentRewardEligibleType;
};

export type RewardsOverview = {
  totalCredits: number;
  referralCredits: number;
  paymentCredits: number;
  totalReferrals: number;
  paymentVolume: number;
  paymentRewardRate: number;
  creditsPerReferral: number;
  referralItems: ReferralRewardItem[];
  paymentItems: PaymentRewardItem[];
};

const ELIGIBLE_PAYMENT_TYPES = [...PAYMENT_REWARD_ELIGIBLE_TYPES];

export async function getRewardsOverview(
  userId: ObjectId,
  workspaceId: ObjectId,
): Promise<RewardsOverview> {
  const db = await getDb();

  const [referralOverview, paymentTransactions] = await Promise.all([
    getReferralOverview(userId),
    db
      .collection<TransactionDoc>(COLLECTIONS.transactions)
      .find({
        workspaceId,
        status: "confirmed",
        type: { $in: ELIGIBLE_PAYMENT_TYPES },
      })
      .sort({ occurredAt: -1 })
      .toArray(),
  ]);

  const referralItems: ReferralRewardItem[] = referralOverview.referrals.map(
    (referral) => ({
      ...referral,
      credits: REFERRAL_CREDITS_PER_SIGNUP,
    }),
  );

  const paymentItems: PaymentRewardItem[] = paymentTransactions.map((tx) => ({
    id: tx._id.toString(),
    label: tx.label,
    amount: tx.amount,
    symbol: tx.symbol,
    credits: calculatePaymentRewardCredits(tx.amount),
    dateLabel: formatPaymentDateTime(tx.occurredAt),
    type: tx.type as PaymentRewardEligibleType,
  }));

  const paymentVolume = paymentTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const paymentCredits = paymentItems.reduce(
    (sum, item) => sum + item.credits,
    0,
  );
  const referralCredits = referralOverview.totalReferrals * REFERRAL_CREDITS_PER_SIGNUP;

  return {
    totalCredits: referralCredits + paymentCredits,
    referralCredits,
    paymentCredits,
    totalReferrals: referralOverview.totalReferrals,
    paymentVolume,
    paymentRewardRate: PAYMENT_REWARD_RATE,
    creditsPerReferral: REFERRAL_CREDITS_PER_SIGNUP,
    referralItems,
    paymentItems,
  };
}
