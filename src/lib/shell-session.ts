import { redirect } from "next/navigation";

import { getSessionFromCookies } from "@/lib/db/auth";
import { listVerifiedWallets } from "@/lib/db/wallets";
import { buildProfileUrl } from "@/lib/profile-url";

export async function requireShellSession(redirectPath?: string) {
  const session = await getSessionFromCookies();
  if (!session) {
    // Cookie deletes are not allowed in Server Components — clear via route handler.
    const signInPath = redirectPath
      ? `/sign-in?redirect=${encodeURIComponent(redirectPath)}`
      : "/sign-in";
    redirect(`/api/auth/logout?next=${encodeURIComponent(signInPath)}`);
  }

  return {
    session,
    user: {
      name: session.user.name,
      role: session.user.role
        ? session.user.role.charAt(0).toUpperCase() +
          session.user.role.slice(1)
        : "Owner",
      initials: session.user.initials,
      username: session.user.username ?? null,
      hasVerifiedWallet: listVerifiedWallets(session.user).length > 0,
    },
    workspace: {
      name: session.workspace.name,
      slug: session.workspace.slug,
      paymentLink: session.user.username
        ? buildProfileUrl(session.user.username)
        : "",
    },
  };
}
