import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { getSessionFromCookies } from "@/lib/db/auth";
import { ensureDbIndexes } from "@/lib/db/seed";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default async function SettingsPage() {
  await ensureDbIndexes();

  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/sign-in?redirect=/settings");
  }

  const walletProvider = session.user.authProviders.find(
    (provider) => provider.type === "wallet"
  );

  const derivedName = splitName(session.user.name);
  const profile = {
    firstName: session.user.profile?.firstName ?? derivedName.firstName,
    lastName: session.user.profile?.lastName ?? derivedName.lastName,
    phone: session.user.profile?.phone,
    company: session.user.profile?.company,
  };

  const settingsUser = {
    name: session.user.name,
    email: session.user.email,
    username: session.user.username,
    profile,
    initials: session.user.initials,
    role:
      session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1),
    plan: session.workspace.plan,
    isProUser: session.workspace.plan === "enterprise",
    authMethod: session.user.authProviders[0]?.type,
    walletAddress: walletProvider?.providerId ?? session.user.walletAddresses[0],
  };

  const shellUser = {
    name: session.user.name,
    role:
      session.user.role.charAt(0).toUpperCase() + session.user.role.slice(1),
    initials: session.user.initials,
  };

  const shellWorkspace = {
    name: session.workspace.name,
    slug: session.workspace.slug,
    paymentLink: `pay.fidence.xyz/${session.workspace.slug}`,
  };

  return (
    <AppShell
      title="Settings"
      user={shellUser}
      workspace={shellWorkspace}
      hideSiteHeader
    >
      <SettingsPageContent user={settingsUser} />
    </AppShell>
  );
}
