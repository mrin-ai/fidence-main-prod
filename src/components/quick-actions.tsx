import type { ReactNode } from "react"
import {
  ArrowRightIcon,
  Code2Icon,
  GiftIcon,
  Link2Icon,
  PlusIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

type ActionCardProps = {
  title: string
  subtitle: string
  icon: ReactNode
  href?: string
  variant?: "primary" | "secondary"
}

function ActionCard({
  title,
  subtitle,
  icon,
  href = "#",
  variant = "secondary",
}: ActionCardProps) {
  const isPrimary = variant === "primary"

  return (
    <a
      href={href}
      className={cn(
        "group flex min-h-[8.75rem] flex-col justify-between rounded-xl p-4 transition-colors",
        isPrimary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border/50 bg-card shadow-none hover:border-primary/30 hover:bg-secondary"
      )}
    >
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
        <ArrowRightIcon
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
            isPrimary ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        />
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
    </a>
  )
}

const actions: ActionCardProps[] = [
  {
    title: "Create Payment Link",
    subtitle: "Generate a new link",
    icon: <PlusIcon className="size-4" />,
    variant: "primary",
  },
  {
    title: "Manage Links",
    subtitle: "View all payment links",
    icon: <Link2Icon className="size-4" />,
  },
  {
    title: "Rewards",
    subtitle: "View earned creator rewards",
    icon: <GiftIcon className="size-4" />,
  },
  {
    title: "API Documentation",
    subtitle: "Explore developer guides",
    icon: <Code2Icon className="size-4" />,
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <ActionCard key={action.title} {...action} />
      ))}
    </div>
  )
}
