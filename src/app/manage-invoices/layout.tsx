import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSessionFromCookies } from "@/lib/db/auth";
import { ensureDbIndexes } from "@/lib/db/seed";

export default async function ManageInvoicesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await ensureDbIndexes();

  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/manage-invoices");
  }

  const user = {
    name: session.user.name,
    role: session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1),
    initials: session.user.initials,
  };

  const workspace = {
    name: session.workspace.name,
    slug: session.workspace.slug,
    paymentLink: `pay.fidence.xyz/${session.workspace.slug}`,
  };

  return (
    <AppShell title="Manage Invoices" user={user} workspace={workspace}>
      {children}
    </AppShell>
  );
}
