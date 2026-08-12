"use client";

import { useState } from "react";
import { CopyIcon, KeyRoundIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { MerchantApiDocs } from "@/components/merchant/merchant-api-docs";
import type { ApiKeyOverview } from "@/lib/merchant-ui-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ApiCredentialsPageContent({
  initialOverview,
  baseUrl,
}: {
  initialOverview: ApiKeyOverview;
  baseUrl: string;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/merchant/api-key", { method: "POST" });
      const data = (await response.json()) as {
        apiKey?: string;
        maskedKey?: string;
        keyLast4?: string;
        createdAt?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate API key");
      }

      setPlainKey(data.apiKey ?? null);
      setOverview({
        hasKey: true,
        maskedKey: data.maskedKey ?? null,
        keyLast4: data.keyLast4 ?? null,
        createdAt: data.createdAt ?? null,
        lastUsedAt: overview.lastUsedAt,
      });
      toast.success("API key generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate API key",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">API Credentials</h2>
        <p className="text-sm text-muted-foreground">
          One API key per workspace. Share it with your agents to connect to
          Fidence.
        </p>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Merchant API key</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isGenerating}
              onClick={handleGenerate}
            >
              <RefreshCwIcon className="size-4" />
              {overview.hasKey ? "Rotate key" : "Generate key"}
            </Button>
          </div>

          {plainKey ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium text-amber-800">
                Copy this key now. It will not be shown again.
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="break-all font-mono text-sm">{plainKey}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleCopy(plainKey)}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>
          ) : overview.hasKey ? (
            <div className="rounded-xl border border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">Active key</p>
              <p className="mt-1 font-mono text-sm">{overview.maskedKey}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No API key yet. Generate one to let agents connect.
            </p>
          )}
        </CardContent>
      </Card>

      <MerchantApiDocs baseUrl={baseUrl} />
    </div>
  );
}
