import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth-card";
import { ReferralCapture } from "@/components/referrals/referral-capture";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Fidence to manage payment links, track transactions, and access your merchant dashboard.",
  alternates: {
    canonical: "/sign-in",
  },
  openGraph: {
    title: "Sign In · Fidence",
    description:
      "Sign in to Fidence to manage payment links, track transactions, and access your merchant dashboard.",
    url: "https://www.payagent.co/sign-in",
    images: ["https://www.payagent.co/payagent-og.png"],
  },
};

function SignInContent() {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <AuthCard
        title="Welcome back"
        description="Sign in to manage payment links, track transactions, and access your Fidence dashboard."
        mode="sign-in"
      />
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
