import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE } from "@/lib/auth-session";

export default async function HomePage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  redirect(token ? "/dashboard" : "/sign-in");
}
