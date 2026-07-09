import { isCacheAvailable } from "@/lib/cache/redis";
import { getDb } from "@/lib/db/client";

export async function GET() {
  const health: Record<string, string> = {
    redis: isCacheAvailable() ? "ok" : "unconfigured",
  };

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    health.db = "ok";
  } catch {
    health.db = "error";
    return Response.json(health, { status: 503 });
  }

  return Response.json(health);
}
