import Link from "next/link";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FidenceLogoIcon } from "@/components/fidence-logo-icon";
import { MerchantApiDocs } from "@/components/merchant/merchant-api-docs";
import { buttonVariants } from "@/components/ui/button";
import { getPaymentBaseUrl } from "@/lib/payment-link-url";
import { cn } from "@/lib/utils";
import { renderSimpleMarkdown } from "@/lib/simple-markdown";

export const metadata = {
  title: "Documentation",
  description: "Fidence product overview and merchant API reference.",
};

function loadOverviewMarkdown() {
  const filePath = resolve(process.cwd(), "docs/fidence-overview.md");
  return readFileSync(filePath, "utf8");
}

export default function DocsPage() {
  const markdown = loadOverviewMarkdown();
  const html = renderSimpleMarkdown(markdown);
  const apiBaseUrl = getPaymentBaseUrl();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="inline-flex shrink-0 items-center">
              <div className="flex size-8 shrink-0 items-center justify-center overflow-visible rounded-lg border border-border/50 bg-white">
                <FidenceLogoIcon className="size-6" />
              </div>
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-medium">Fidence Docs</p>
              <p className="text-sm text-muted-foreground">
                Product overview and merchant API reference
              </p>
            </div>
          </div>
          <Link
            href="/merchant/api-credentials"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open portal API docs
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:px-8 lg:py-10">
        <article
          className="prose prose-neutral max-w-none space-y-4 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold">Merchant API reference</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Interactive request examples for agent registration, payment links,
              pay flows, and compliance.
            </p>
            <Link
              href="/sign-in?next=/merchant/api-credentials"
              className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
            >
              Sign in to manage keys
            </Link>
          </div>

          <div className="hidden lg:block">
            <MerchantApiDocs baseUrl={apiBaseUrl} />
          </div>
        </aside>
      </main>
    </div>
  );
}
