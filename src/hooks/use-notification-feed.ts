"use client";

import { useCallback, useEffect, useState } from "react";

import type { ActivityItem } from "@/components/activity/activity-list";
import {
  NOTIFICATIONS_LAST_SEEN_KEY,
  useLocalStorageString,
} from "@/hooks/use-local-preference";

type ActivityFeedResponse = {
  items: ActivityItem[];
};

const NOTIFICATION_LIMIT = 8;
const POLL_INTERVAL_MS = 30_000;

function countUnread(items: ActivityItem[], lastSeenAt: string) {
  if (!lastSeenAt) return 0;

  const seenTime = new Date(lastSeenAt).getTime();
  return items.filter((item) => {
    if (!item.occurredAt) return false;
    return new Date(item.occurredAt).getTime() > seenTime;
  }).length;
}

export function useNotificationFeed(enabled: boolean) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useLocalStorageString(
    NOTIFICATIONS_LAST_SEEN_KEY,
  );

  const fetchActivities = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch(
        `/api/activity?limit=${NOTIFICATION_LIMIT}&page=1`,
      );
      if (!response.ok) return;

      const data = (await response.json()) as ActivityFeedResponse;
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchActivities();

    const interval = window.setInterval(() => {
      void fetchActivities();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [enabled, fetchActivities]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    if (items.length === 0) {
      setUnreadCount(0);
      return;
    }

    if (!lastSeenAt) {
      setLastSeenAt(items[0].occurredAt ?? new Date().toISOString());
      setUnreadCount(0);
      return;
    }

    setUnreadCount(countUnread(items, lastSeenAt));
  }, [items, lastSeenAt, enabled, setLastSeenAt]);

  const markAllSeen = useCallback(() => {
    if (!enabled || items.length === 0) return;

    const nextSeenAt = items[0].occurredAt ?? new Date().toISOString();
    setLastSeenAt(nextSeenAt);
    setUnreadCount(0);
  }, [enabled, items, setLastSeenAt]);

  return {
    items,
    loading,
    unreadCount,
    markAllSeen,
    refresh: fetchActivities,
  };
}
