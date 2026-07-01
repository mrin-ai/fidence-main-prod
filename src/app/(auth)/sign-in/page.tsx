import { Suspense } from "react";
import AuthCard from "@/components/auth-card";

function SignInContent() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to manage payment links, track transactions, and access your LCX dashboard."
      mode="sign-in"
    />
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
