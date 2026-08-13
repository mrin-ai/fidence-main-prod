"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 4;

const SKILL_COMMAND =
  "npx skills add https://github.com/mrin-ai/fidence-skills --skill fidence-pay --global --yes";

const AUTH_PROMPT =
  "Help me set up Fidence Pay and authorize this agent to use my wallet.";

const STEPS = [
  {
    title: "Install the Fidence skill",
    description:
      "Run this command in the chat or CLI wherever you use your agent — Cursor, Claude Code, Slack, Discord, Codex, etc.",
    footer: "After installation, restart your agent and continue.",
  },
  {
    title: "Authorize your agent",
    description:
      "Send this prompt to your agent so it starts the Fidence Pay setup and opens an approval link.",
    footer: "Your agent will generate a link for you to approve in the browser.",
  },
  {
    title: "Approve the connection",
    description:
      "Open the authorization link from your agent, or paste the link ID below. Then run poll in the terminal.",
    footer: null,
  },
  {
    title: "Set up wallet & mandate",
    description:
      "Add a payer wallet and activate spending rules so your agent can pay within limits.",
    footer: "You can finish wallet setup on the Mandates tab after closing this guide.",
  },
] as const;

function StepProgress({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Step {step} of {TOTAL_STEPS}
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <div
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-sm transition-colors",
              index < step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CopySnippet({ value, prefix = "$ " }: { value: string; prefix?: string }) {
  return (
    <div className="relative rounded-lg border border-border/80 bg-muted/40 p-4 pr-12">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground">
        {prefix}
        {value}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
      >
        <CopyIcon className="size-4" />
        <span className="sr-only">Copy</span>
      </Button>
    </div>
  );
}

export function ConnectAgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [manualLid, setManualLid] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setManualLid("");
    }
  }, [open]);

  const current = STEPS[step - 1];
  const connectHref = manualLid.trim()
    ? `/pay/connect?lid=${encodeURIComponent(manualLid.trim())}`
    : null;

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
      return;
    }
    onOpenChange(false);
  }

  function handleBack() {
    if (step > 1) setStep((prev) => prev - 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg" showCloseButton>
        <div className="flex max-h-[85vh] flex-col">
          <div className="space-y-6 border-b border-border/60 px-6 pb-5 pt-6">
            <StepProgress step={step} />
            <div className="space-y-2">
              <h2 className="font-serif text-xl font-medium tracking-tight text-foreground">
                {current.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{current.description}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 ? <CopySnippet value={SKILL_COMMAND} /> : null}

            {step === 2 ? <CopySnippet value={AUTH_PROMPT} prefix="" /> : null}

            {step === 3 ? (
              <div className="space-y-4">
                <Input
                  placeholder="lnk_…"
                  value={manualLid}
                  onChange={(event) => setManualLid(event.target.value)}
                />
                {connectHref ? (
                  <Button
                    nativeButton={false}
                    variant="outline"
                    className="w-full"
                    render={<Link href={connectHref} />}
                  >
                    Open approval page
                    <ExternalLinkIcon className="ml-2 size-4" />
                  </Button>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <Button nativeButton={false} className="w-full" render={<Link href="/pay/mandates" />}>
                  Go to Mandates
                </Button>
                <Button
                  nativeButton={false}
                  variant="outline"
                  className="w-full"
                  render={<Link href="/wallets" />}
                >
                  Manage wallets
                </Button>
              </div>
            ) : null}

            {current.footer ? (
              <p className="mt-4 text-sm text-muted-foreground">{current.footer}</p>
            ) : null}

            {step === 3 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Run <code className="rounded bg-muted px-1">fidence setup poll</code> in your agent
                terminal after you approve in the browser.
              </p>
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-border/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={step === 1}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button type="button" className="flex-1" onClick={handleNext}>
              {step === TOTAL_STEPS ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
