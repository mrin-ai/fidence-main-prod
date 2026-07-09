import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ActivityEventDoc } from "@/lib/db/types";

const DEFAULT_HOT_DAYS = 90;
const BATCH_SIZE = 500;

export async function archiveStaleActivity() {
  const configured = Number(process.env.ACTIVITY_HOT_DAYS ?? DEFAULT_HOT_DAYS);
  const days = Number.isFinite(configured) ? configured : DEFAULT_HOT_DAYS;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const db = await getDb();
  let archived = 0;

  while (true) {
    const staleEvents = await db
      .collection<ActivityEventDoc>(COLLECTIONS.activityEvents)
      .find({ occurredAt: { $lt: cutoff } })
      .sort({ occurredAt: 1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (staleEvents.length === 0) {
      break;
    }

    await db
      .collection<ActivityEventDoc>(COLLECTIONS.activityEventsArchive)
      .insertMany(staleEvents);

    await db.collection(COLLECTIONS.activityEvents).deleteMany({
      _id: { $in: staleEvents.map((event) => event._id) },
    });

    archived += staleEvents.length;

    if (staleEvents.length < BATCH_SIZE) {
      break;
    }
  }

  return { archived, cutoff: cutoff.toISOString() };
}
