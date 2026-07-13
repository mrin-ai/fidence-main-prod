"use client"

import { usePathname } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { getShellTitle, shouldHideShellHeader } from "@/lib/shell-titles"

export function ShellHeader({ title }: { title?: string }) {
  const pathname = usePathname()

  if (shouldHideShellHeader(pathname)) {
    return null
  }

  return <SiteHeader title={title ?? getShellTitle(pathname)} />
}
