import { Suspense } from "react";
import AuthCard from "@/components/auth-card";
import { ReferralCapture } from "@/components/referrals/referral-capture";

function SignUpContent() {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <AuthCard
        title="Create an account"
        description="Join thousands of merchants using PayAgent to accept payments and grow their business."
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
