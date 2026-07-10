"use client";

import {
  ArrowUpRightIcon,
  BanIcon,
  CircleCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  LinkIcon,
  LogInIcon,
  LogOutIcon,
  PencilIcon,
  SendIcon,
  ShoppingCartIcon,
  Trash2Icon,
  UserIcon,
  WalletIcon,
} from "lucide-react";

import type { ActivityStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  summary: string;
  meta: string;
  status?: ActivityStatus;
  type: string;
};

export function getActivityVisual(type: string, status?: ActivityStatus) {
  if (type === "login") {
    return {
      icon: <LogInIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    };
  }

  if (type === "logout") {
    return {
      icon: <LogOutIcon className="size-3.5" />,
      iconClassName: "bg-muted text-muted-foreground",
    };
  }

  if (
    type === "payment_link_created" ||
    type === "invoice_payment_link_created"
  ) {
    return {
      icon: <LinkIcon className="size-3.5" />,
      iconClassName: "bg-accent/70 text-primary",
    };
  }

  if (
    type === "payment_received" ||
    type === "profile_payment" ||
    type === "invoice_paid"
  ) {
    return {
      icon: <CircleCheckIcon className="size-3.5" />,
      iconClassName: "bg-green-500/10 text-green-600",
    };
  }

  if (type === "payment_sent") {
    return {
      icon: <ArrowUpRightIcon className="size-3.5" />,
      iconClassName: "bg-amber-500/10 text-amber-700",
    };
  }

  if (type === "invoice_created") {
    return {
      icon: <FileTextIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-secondary-foreground",
    };
  }

  if (type === "invoice_sent") {
    return {
      icon: <SendIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    };
  }

  if (type === "invoice_updated") {
    return {
      icon: <PencilIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-secondary-foreground",
    };
  }

  if (type === "invoice_deleted") {
    return {
      icon: <Trash2Icon className="size-3.5" />,
      iconClassName: "bg-destructive/8 text-destructive",
    };
  }

  if (type === "wallet_verified" || type === "wallet_removed") {
    return {
      icon: <WalletIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    };
  }

  if (type === "username_updated" || type === "profile_updated") {
    return {
      icon: <UserIcon className="size-3.5" />,
      iconClassName: "bg-accent/70 text-primary",
    };
  }

  if (status === "blocked" || type === "blocked") {
    return {
      icon: <BanIcon className="size-3.5" />,
      iconClassName: "bg-destructive/8 text-destructive",
    };
  }

  if (type === "wallet_funded") {
    return {
      icon: <CreditCardIcon className="size-3.5" />,
      iconClassName: "bg-secondary text-primary",
    };
  }

  return {
    icon: <ShoppingCartIcon className="size-3.5" />,
    iconClassName: "bg-accent/70 text-primary",
  };
}

function ActivityStatusDot({ status }: { status: ActivityStatus }) {
  return (
    <span
      className={cn(
        "mt-1 size-1.5 shrink-0 rounded-full",
        status === "settled" ? "bg-green-500" : "bg-red-500",
      )}
    />
  );
}

export function ActivityList({
  activities,
  className,
  emptyTitle = "No activity yet",
  emptyDescription = "Account events will show up here.",
}: {
  activities: ActivityItem[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyTitle}. {emptyDescription}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {activities.map((activity) => {
        const visual = getActivityVisual(activity.type, activity.status);

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                visual.iconClassName,
              )}
            >
              {visual.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-snug text-foreground/90">
                {activity.summary}
              </p>
              <p className="font-mono text-[0.6875rem] text-muted-foreground">
                {activity.meta}
              </p>
            </div>
            {activity.status ? (
              <ActivityStatusDot status={activity.status} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
