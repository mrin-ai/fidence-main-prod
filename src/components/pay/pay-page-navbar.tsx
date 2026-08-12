"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { useCreatePaymentLink } from "@/components/create-payment-link-sheet";
import { FidenceLogoIcon } from "@/components/fidence-logo-icon";
import { Button } from "@/components/ui/button";

export function PayPageNavbar() {
  const router = useRouter();
  const { openCreatePaymentLink } = useCreatePaymentLink();

  async function handleCreateLink() {
    const response = await fetch("/api/auth/session");

    if (response.ok) {
      openCreatePaymentLink();
      return;
    }

    router.push("/sign-in?redirect=/dashboard");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-6">
        <Link href="/dashboard" className="inline-flex shrink-0 items-center">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-visible rounded-lg border border-border/50 bg-white">
            <FidenceLogoIcon className="size-6" />
          </div>
        </Link>
        <Button
          size="sm"
          className="h-8 rounded-lg px-3 text-xs"
          onClick={handleCreateLink}
        >
          <PlusIcon className="size-3.5" />
          Create link
        </Button>
      </div>
    </header>
  );
}
