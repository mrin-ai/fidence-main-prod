"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  Code2Icon,
  GiftIcon,
  Link2Icon,
  PlusIcon,
} from "lucide-react"

import { useCreatePaymentLink } from "@/components/create-payment-link-sheet"
import { cn } from "@/lib/utils"

type ActionCardProps = {
  title: string
  subtitle: string
  icon: ReactNode
  href?: string
  onClick?: () => void
  variant?: "primary" | "secondary"
  comingSoon?: boolean
}

function ActionCard({
  title,
  subtitle,
  icon,
  href = "#",
  onClick,
  variant = "secondary",
  comingSoon = false,
}: ActionCardProps) {
  const isPrimary = variant === "primary"

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            isPrimary
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-accent text-primary"
          )}
        >
          {icon}
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium text-secondary-foreground">
            Soon
          </span>
        ) : (
          <ArrowRightIcon
            className={cn(
              "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
              isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p
          className={cn(
            "text-xs leading-snug",
            isPrimary ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      </div>
    </>
  )

  if (comingSoon) {
    return (
      <div
        aria-disabled
        className={cn(
          "flex min-h-[8.75rem] cursor-default flex-col justify-between rounded-xl border border-border/50 bg-card p-4 opacity-70 shadow-none",
          isPrimary && "border-primary/20 bg-primary/90 text-primary-foreground"
        )}
      >
        {content}
      </div>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex min-h-[8.75rem] w-full flex-col justify-between rounded-xl p-4 text-left transition-colors",
          isPrimary
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border/50 bg-card shadow-none hover:border-primary/30 hover:bg-secondary"
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[8.75rem] flex-col justify-between rounded-xl p-4 transition-colors",
        isPrimary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border/50 bg-card shadow-none hover:border-primary/30 hover:bg-secondary"
      )}
    >
      {content}
    </Link>
  )
}

export function QuickActions() {
  const { openCreatePaymentLink } = useCreatePaymentLink()

  const actions: ActionCardProps[] = [
    {
      title: "Create Payment Link",
      subtitle: "Generate a new link",
      icon: <PlusIcon className="size-4" />,
      variant: "primary",
      onClick: openCreatePaymentLink,
    },
    {
      title: "Manage Links",
      subtitle: "View all payment links",
      icon: <Link2Icon className="size-4" />,
      href: "/payment-links",
    },
    {
      title: "Referrals",
      subtitle: "Invite merchants and earn LCX",
      icon: <GiftIcon className="size-4" />,
      comingSoon: true,
    },
    {
      title: "API Documentation",
      subtitle: "Explore developer guides",
      icon: <Code2Icon className="size-4" />,
      comingSoon: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <ActionCard key={action.title} {...action} />
      ))}
    </div>
  )
}
