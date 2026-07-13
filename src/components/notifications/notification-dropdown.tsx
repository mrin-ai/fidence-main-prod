"use client";

import { useState } from "react";
import Link from "next/link";
import { BellIcon, BellOffIcon, Loader2Icon } from "lucide-react";

import type { ActivityItem } from "@/components/activity/activity-list";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NOTIFICATIONS_ENABLED_KEY,
  useLocalPreference,
} from "@/hooks/use-local-preference";
import { useNotificationFeed } from "@/hooks/use-notification-feed";
import { cn } from "@/lib/utils";

function NotificationList({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No activity yet
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {activities.map((activity) => (
        <li key={activity.id} className="px-4 py-3">
          <p className="text-sm leading-snug text-foreground">
            {activity.summary}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{activity.meta}</p>
        </li>
      ))}
    </ul>
  );
}

function NotificationsDisabledState() {
  return (
    <div className="px-4 py-8 text-center">
      <BellOffIcon className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-3 text-sm text-foreground">Notifications are off</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Turn them on from your profile menu to receive activity alerts.
      </p>
    </div>
  );
}

export function NotificationDropdown() {
  const [notificationsEnabled] = useLocalPreference(
    NOTIFICATIONS_ENABLED_KEY,
    true,
  );
  const { items, loading, unreadCount, markAllSeen } =
    useNotificationFeed(notificationsEnabled);
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && notificationsEnabled) {
          markAllSeen();
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "relative size-8 shrink-0",
              !notificationsEnabled && "text-muted-foreground",
            )}
            aria-label={
              notificationsEnabled
                ? "Notifications"
                : "Notifications turned off"
            }
          />
        }
      >
        {notificationsEnabled ? (
          <BellIcon className="size-4" />
        ) : (
          <BellOffIcon className="size-4" />
        )}
        {notificationsEnabled && unreadCount > 0 ? (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 overflow-hidden p-0 sm:w-80"
        sideOffset={8}
      >
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-sm font-medium">Activity</p>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {!notificationsEnabled ? (
            <NotificationsDisabledState />
          ) : loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
            </div>
          ) : (
            <NotificationList activities={items} />
          )}
        </div>

        <div className="border-t border-border/50 px-4 py-2.5 text-center">
          <Link
            href="/activity"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
