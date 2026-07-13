"use client";

import Link from "next/link";
import { useMemo } from "react";

import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RewardsOverview } from "@/lib/db/rewards";
import {
  formatPaymentRewardRate,
  formatRewardCredits,
} from "@/lib/reward-config";

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function formatAmount(amount: number, symbol: string) {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${symbol.toUpperCase()}`;
}

export function RewardsPageContent({
  overview,
}: {
  overview: RewardsOverview;
}) {
  const subtitle = useMemo(() => {
    if (overview.totalCredits === 0) {
      return "Earn credits from referrals and payments you send or receive.";
    }
    return `${formatRewardCredits(overview.totalCredits)} credits earned across referrals and payments.`;
  }, [overview.totalCredits]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Rewards</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox
          label="Total credits"
          value={formatRewardCredits(overview.totalCredits)}
        />
        <StatBox
          label="From referrals"
          value={formatRewardCredits(overview.referralCredits)}
          hint={`${overview.creditsPerReferral} per signup`}
        />
        <StatBox
          label="From payments"
          value={formatRewardCredits(overview.paymentCredits)}
          hint={formatPaymentRewardRate(overview.paymentRewardRate)}
        />
      </div>

      <Tabs defaultValue="referrals">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBox
              label="Total referrals"
              value={overview.totalReferrals}
            />
            <StatBox
              label="Referral credits"
              value={formatRewardCredits(overview.referralCredits)}
              hint={`${overview.creditsPerReferral} credits each`}
            />
          </div>

          <Card className="border-border/60 shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Referral rewards</p>
                <Link
                  href="/referrals"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Manage referrals
                </Link>
              </div>

              {overview.referralItems.length === 0 ? (
                <EmptyStateLottie
                  title="No referral rewards yet"
                  description="Share your referral link to earn credits when merchants sign up."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Identity</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.referralItems.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px]">
                                {referral.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {referral.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs">{referral.identity}</p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {referral.signUpMethod}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {referral.username ? `@${referral.username}` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {formatRewardCredits(referral.credits)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {referral.joinedAtLabel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBox
              label="Payment volume"
              value={overview.paymentVolume.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}
              hint="Payments sent and received"
            />
            <StatBox
              label="Payment credits"
              value={formatRewardCredits(overview.paymentCredits)}
              hint={`${formatPaymentRewardRate(overview.paymentRewardRate)} per payment`}
            />
          </div>

          <Card className="border-border/60 shadow-none">
            <CardContent className="p-5">
              <p className="mb-4 text-sm font-medium">Payment rewards</p>

              {overview.paymentItems.length === 0 ? (
                <EmptyStateLottie
                  title="No payment rewards yet"
                  description="Earn 0.1% credits when you pay or receive confirmed payments through PayAgent."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.paymentItems.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="max-w-[180px] truncate text-sm font-medium">
                          {payment.label}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {payment.type.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatAmount(payment.amount, payment.symbol)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {formatRewardCredits(payment.credits)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {payment.dateLabel}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
