"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We couldn&apos;t load this page. This can happen right after sign-in if
        the database or cache is still connecting. Try again in a moment.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Error {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Go to Overview
        </Button>
      </div>
    </div>
  );
}
