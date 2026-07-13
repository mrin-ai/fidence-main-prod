"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Web3WalletButton } from "@/components/web3-wallet-button";
import { getClientReferralCode } from "@/components/referrals/referral-capture";

function GoogleIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 256 262" preserveAspectRatio="xMidYMid" {...props}>
      <path
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
        fill="#4285F4"
      />
      <path
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
        fill="#34A853"
      />
      <path
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
        fill="#FBBC05"
      />
      <path
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
        fill="#EB4335"
      />
    </svg>
  );
}

interface AuthCardProps {
  title: string;
  description: string;
  mode?: "sign-in" | "sign-up";
}

export default function AuthCard({
  title,
  description,
  mode = "sign-in",
}: AuthCardProps) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const referralCode = getClientReferralCode(searchParams);

  const [googleLoading, setGoogleLoading] = useState(false);

  const signInWithGoogle = () => {
    setGoogleLoading(true);
    const params = new URLSearchParams();
    if (redirect !== "/dashboard") {
      params.set("redirect", redirect);
    }
    const query = params.toString();
    window.location.href = `/api/auth/google${query ? `?${query}` : ""}`;
  };

  const redirectQuery = new URLSearchParams();
  if (redirect !== "/dashboard") {
    redirectQuery.set("redirect", redirect);
  }
  if (referralCode) {
    redirectQuery.set("ref", referralCode);
  }
  const authQuery = redirectQuery.toString() ? `?${redirectQuery.toString()}` : "";

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="mb-3 font-serif text-3xl font-light tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {mode === "sign-up" && (
        <div className="mb-8 flex items-center justify-center gap-3">
          {["Free to start", "No setup fees", "Cancel anytime"].map((label) => (
            <span
              key={label}
              className="rounded-full bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-background text-sm transition-all duration-200 hover:border-foreground/15 hover:bg-muted/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={googleLoading}
        onClick={signInWithGoogle}
      >
        <div className="flex h-5 w-5 items-center justify-center">
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
        </div>
        <span className="font-medium text-foreground/80 transition-colors group-hover:text-foreground">
          Google
        </span>
      </button>

      <Web3WalletButton />

      {mode === "sign-up" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-3.5">
          <Sparkles className="h-4 w-4 shrink-0 text-primary/60" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Enterprise plans available
            </span>{" "}
            for high-volume merchants. Custom limits, dedicated support, and
            advanced compliance.
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <span className="text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Don't have an account? "
            : "Already have an account? "}
        </span>
        <Link
          href={
            mode === "sign-in"
              ? `/sign-up${authQuery}`
              : `/sign-in${authQuery}`
          }
          className="text-sm font-medium text-primary transition-colors hover:underline hover:underline-offset-4"
        >
          {mode === "sign-in" ? "Sign up" : "Sign in"}
        </Link>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
