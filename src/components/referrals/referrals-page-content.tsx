"use client";

import { useMemo } from "react";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import type { ReferralOverview } from "@/lib/db/referrals";
import { EmptyStateLottie } from "@/components/empty-state-lottie";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CopyIconButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-muted-foreground"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast.success(`${label} copied`);
      }}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      <CopyIcon className="size-4" />
    </Button>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ReferralsPageContent({ overview }: { overview: ReferralOverview }) {
  const subtitle = useMemo(() => {
    if (overview.totalReferrals === 0) {
      return "Share your link to invite merchants and earn 5 LCX per signup.";
    }
    return `${overview.totalReferrals} merchant${
      overview.totalReferrals === 1 ? "" : "s"
    } joined through your link.`;
  }, [overview.totalReferrals]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Referrals</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {overview.referredBy ? (
        <p className="text-sm text-muted-foreground">
          Referred by{" "}
          <span className="font-medium text-foreground">
            {overview.referredBy.username
              ? `@${overview.referredBy.username}`
              : overview.referredBy.name}
          </span>
        </p>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-4 p-5">
          <p className="text-sm font-medium">Your referral link</p>

          <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <p className="text-xs text-muted-foreground">Referral code</p>
              <p className="mt-0.5 font-mono text-base font-semibold tracking-wide">
                {overview.referralCode}
              </p>
            </div>
            <CopyIconButton value={overview.referralCode} label="Code" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Invite link · 5 LCX per referral
              </p>
              <p className="mt-0.5 break-all font-mono text-sm text-foreground/90">
                {overview.referralUrl}
              </p>
            </div>
            <CopyIconButton value={overview.referralUrl} label="Link" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatBox label="Total referrals" value={overview.totalReferrals} />
        <StatBox label="Credit earned" value={overview.lcxRewards} />
      </div>

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-5">
          <p className="mb-4 text-sm font-medium">Referred merchants</p>

          {overview.referrals.length === 0 ? (
            <EmptyStateLottie
              title="No referrals yet"
              description="Share your link. New signups will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {referral.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{referral.name}</span>
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
    </div>
  );
}
