import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { hasUsername } from "@/lib/onboarding";
import { requireShellSession } from "@/lib/shell-session";

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
    >
      {children}
    </AppShell>
  );
}
