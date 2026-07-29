"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlayIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPaymentBaseUrl } from "@/lib/payment-link-url";
import { cn } from "@/lib/utils";

const INTRO_STEPS = [
  {
    title: "Welcome to PayAgent",
    subtitle:
      "Create payment links and professional invoices in minutes — no code required.",
  },
  {
    title: "Get paid in crypto",
    subtitle:
      "Accept USDC, USDT, ETH, and SOL across Ethereum, Base, and Solana.",
  },
] as const;

function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function VideoPlaceholder() {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border/60 bg-muted/40">
      <div className="flex size-14 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
        <PlayIcon className="size-6 text-muted-foreground" />
      </div>
    </div>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-1.5 rounded-full transition-colors",
            index === step ? "bg-primary" : "bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingModal() {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const [step, setStep] = React.useState(0);
  const [username, setUsername] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const allowClose = React.useRef(false);

  const preview = normalizeUsernameInput(username);
  const profileUrl = preview
    ? `${getPaymentBaseUrl()}/${preview}`
    : `${getPaymentBaseUrl()}/username`;
  const totalSteps = INTRO_STEPS.length + 1;
  const isUsernameStep = step === INTRO_STEPS.length;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    if (allowClose.current) {
      setOpen(false);
    }
  }

  function handleSkipAndContinue() {
    setStep((current) => current + 1);
  }

  async function handleSaveUsername(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "username",
          username: preview,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        username?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save username");
      }

      toast.success(`Welcome @${data.username ?? preview}`);
      allowClose.current = true;
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save username";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        {!isUsernameStep ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-0 text-left">
              <DialogTitle className="font-serif text-2xl font-light tracking-tight">
                {INTRO_STEPS[step].title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {INTRO_STEPS[step].subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5">
              <VideoPlaceholder />
            </div>

            <DialogFooter className="flex-col items-stretch gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-col">
              <Button type="button" className="w-full sm:w-auto sm:self-end" onClick={handleSkipAndContinue}>
                Skip and continue
              </Button>
              <StepDots step={step} total={totalSteps} />
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => void handleSaveUsername(event)}>
            <DialogHeader className="px-6 pt-6 pb-0 text-left">
              <DialogTitle className="font-serif text-2xl font-light tracking-tight">
                Choose your username
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                This becomes your PayAgent profile link for payment links and
                invoices.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="onboarding-username">Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="onboarding-username"
                    value={username}
                    onChange={(event) => {
                      setError(null);
                      setUsername(normalizeUsernameInput(event.target.value));
                    }}
                    placeholder="alexrivera"
                    className="h-11 pl-8 font-mono"
                    autoComplete="username"
                    spellCheck={false}
                    autoFocus
                    disabled={isSaving}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  3–30 characters. Lowercase letters, numbers, and underscores
                  only.
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3">
                <p className="text-[11px] text-muted-foreground">
                  Your profile URL
                </p>
                <p
                  className={cn(
                    "mt-1 break-all font-mono text-sm",
                    preview ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {profileUrl}
                </p>
              </div>

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter className="flex-col items-stretch gap-3 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-col">
              <Button
                type="submit"
                className="w-full sm:w-auto sm:self-end"
                disabled={isSaving || preview.length < 3}
              >
                {isSaving ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              <StepDots step={step} total={totalSteps} />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
