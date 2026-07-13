import { Suspense } from "react";
import AuthCard from "@/components/auth-card";
import { ReferralCapture } from "@/components/referrals/referral-capture";

function SignInContent() {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <AuthCard
        title="Welcome back"
        description="Sign in to manage payment links, track transactions, and access your PayAgent dashboard."
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
