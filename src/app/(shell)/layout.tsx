import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { hasUsername } from "@/lib/onboarding";
import { requireShellSession } from "@/lib/shell-session";

/** Fidence Pay portal UI (sidebar dialogs, auto-pay processor). APIs stay enabled for dev. */
const PAY_PORTAL_UI_ENABLED = false;

export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, user, workspace } = await requireShellSession();

  return (
    <AppShell
      user={user}
      workspace={workspace}
      needsOnboarding={!hasUsername(session.user.username)}
      payEnabled={PAY_PORTAL_UI_ENABLED}
    >
      {children}
    </AppShell>
  );
}
