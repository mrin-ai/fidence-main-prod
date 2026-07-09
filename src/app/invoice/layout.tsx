import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSessionFromCookies } from "@/lib/db/auth";
import { buildProfileUrl } from "@/lib/profile-url";
export default async function InvoiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/invoice");
  }

  const user = {
    name: session.user.name,
    role: session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1),
    initials: session.user.initials,
  };

  const workspace = {
    name: session.workspace.name,
    slug: session.workspace.slug,
    paymentLink: session.user.username
      ? buildProfileUrl(session.user.username)
      : "",
  };

  return (
    <AppShell title="Invoice" user={user} workspace={workspace}>
      {children}
    </AppShell>
  );
}
