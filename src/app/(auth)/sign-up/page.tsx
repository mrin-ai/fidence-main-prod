import { Suspense } from "react";
import AuthCard from "@/components/auth-card";

function SignUpContent() {
  return (
    <AuthCard
      title="Create an account"
      description="Join thousands of merchants using LCX to accept payments and grow their business."
      mode="sign-up"
    />
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
