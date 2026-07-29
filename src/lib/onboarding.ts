import { sanitizeRedirectPath } from "@/lib/sanitize-redirect";

export function hasUsername(
  username: string | null | undefined,
): username is string {
  return Boolean(username?.trim());
}

/** Where to send the user after auth. Onboarding runs as a modal on the shell. */
export function resolvePostAuthPath(
  _username: string | null | undefined,
  intendedRedirect?: string | null,
) {
  const next = sanitizeRedirectPath(intendedRedirect);

  if (next.startsWith("/onboarding")) {
    return "/dashboard";
  }

  return next;
}
