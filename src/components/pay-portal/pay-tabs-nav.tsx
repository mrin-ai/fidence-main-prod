"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/pay/agents", label: "Agents" },
  { href: "/pay/addresses", label: "Addresses" },
  { href: "/pay/mandates", label: "Mandates" },
];

export function PayTabsNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border/60 bg-background px-6 py-4">
      <nav className="mx-auto flex max-w-4xl justify-start">
        <div className="inline-flex rounded-lg bg-muted p-[3px]">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
