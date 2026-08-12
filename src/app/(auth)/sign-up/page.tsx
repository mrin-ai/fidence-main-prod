import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/auth-card";
import { ReferralCapture } from "@/components/referrals/referral-capture";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create your Fidence account to accept crypto payments, create payment links, and earn rewards.",
  alternates: {
    canonical: "/sign-up",
  },
  openGraph: {
    title: "Sign Up · Fidence",
    description:
      "Create your Fidence account to accept crypto payments, create payment links, and earn rewards.",
    url: "https://www.payagent.co/sign-up",
    images: ["https://www.payagent.co/payagent-og.png"],
  },
};

function SignUpContent() {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <AuthCard
        title="Create your account"
        description="Join thousands of merchants using Fidence to accept payments and grow their business."
        mode="sign-up"
      />
    </>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
