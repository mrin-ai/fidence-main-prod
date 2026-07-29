import { resolvePostAuthPath } from "@/lib/onboarding";

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}

/** After auth Set-Cookie, wait until /api/auth/session sees the user before navigating. */
export async function waitForAuthSessionThenRedirect(redirect: string) {
  const intended = sanitizeRedirectPath(redirect);
  let destination = intended;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const sessionRes = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });
      if (sessionRes.ok) {
        const data = (await sessionRes.json()) as {
          user?: { username?: string | null };
          needsOnboarding?: boolean;
        };
        if (data.user) {
          destination = resolvePostAuthPath(data.user.username, intended);
          window.location.replace(destination);
          return;
        }
      }
    } catch {
      // Retry on transient network errors.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  window.location.replace(destination);
}
