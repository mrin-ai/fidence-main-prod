"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function InvoiceFormRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row", className)}>
      {children}
    </div>
  );
}

export function InvoiceFieldLabel({
  children,
  optional,
  optionalLabel = "Optional",
}: {
  children: React.ReactNode;
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <FieldLabel className="flex items-center gap-1.5">
      <span className="text-xs capitalize">{children}</span>
      {optional ? (
        <Badge
          variant="secondary"
          className="h-4 rounded px-1.5 text-[10px] font-medium"
        >
          {optionalLabel}
        </Badge>
      ) : null}
    </FieldLabel>
  );
}

export function InvoiceFieldHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <InfoIcon className="size-2.5 shrink-0 text-muted-foreground" />
      <FieldDescription className="text-xs">{children}</FieldDescription>
    </div>
  );
}
