import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireShellSession } from "@/lib/shell-session";

export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, workspace } = await requireShellSession();

  return (
    <AppShell user={user} workspace={workspace}>
      {children}
    </AppShell>
  );
}
