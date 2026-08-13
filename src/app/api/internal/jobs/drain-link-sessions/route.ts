import { expireStaleLinkSessions } from "@/lib/db/agent-links";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiredLinks = await expireStaleLinkSessions();
  return Response.json({ ok: true, expiredLinks });
}

export async function POST(request: Request) {
  return GET(request);
}
