import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { AUTH_COOKIE } from "@/lib/auth-session";
import { getSessionFromCookies } from "@/lib/db/auth";
import { buildProfileUrl } from "@/lib/profile-url";

export async function requireShellSession(redirectPath?: string) {
  const session = await getSessionFromCookies();
  if (!session) {
    const cookieStore = await cookies();
    if (cookieStore.get(AUTH_COOKIE)?.value) {
      cookieStore.delete(AUTH_COOKIE);
    }
    redirect(
      redirectPath ? `/sign-in?redirect=${redirectPath}` : "/sign-in",
    );
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
