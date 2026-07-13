"use client";

import { useEffect, useState } from "react";

export function useLocalPreference(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored != null) {
      setValue(stored === "true");
    }
  }, [key]);

  function updateValue(next: boolean) {
    setValue(next);
    window.localStorage.setItem(key, String(next));
    window.dispatchEvent(
      new CustomEvent("local-preference-change", {
        detail: { key, value: next },
      }),
    );
  }

  useEffect(() => {
    function onPreferenceChange(event: Event) {
      const detail = (event as CustomEvent<{ key: string; value: boolean }>)
        .detail;
      if (detail?.key === key) {
        setValue(detail.value);
      }
    }

    window.addEventListener("local-preference-change", onPreferenceChange);
    return () =>
      window.removeEventListener("local-preference-change", onPreferenceChange);
  }, [key]);

  return [value, updateValue] as const;
}

export const NOTIFICATIONS_ENABLED_KEY = "lcx-notifications-enabled";
export const NOTIFICATIONS_LAST_SEEN_KEY = "lcx-notifications-last-seen-at";

export function useLocalStorageString(key: string, defaultValue = "") {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored != null) {
      setValue(stored);
    }
  }, [key]);

  function updateValue(next: string) {
    setValue(next);
    window.localStorage.setItem(key, next);
    window.dispatchEvent(
      new CustomEvent("local-storage-change", {
        detail: { key, value: next },
      }),
    );
  }

  useEffect(() => {
    function onStorageChange(event: Event) {
      const detail = (event as CustomEvent<{ key: string; value: string }>)
        .detail;
      if (detail?.key === key) {
        setValue(detail.value);
      }
    }

    window.addEventListener("local-storage-change", onStorageChange);
    return () =>
      window.removeEventListener("local-storage-change", onStorageChange);
  }, [key]);

  return [value, updateValue] as const;
}
