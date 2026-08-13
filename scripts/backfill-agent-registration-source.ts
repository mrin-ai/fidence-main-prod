import { getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";

async function main() {
  const db = await getDb();
  const result = await db.collection(COLLECTIONS.agents).updateMany(
    { registrationSource: { $exists: false } },
    { $set: { registrationSource: "api" } },
  );
  console.log(`Backfilled registrationSource=api on ${result.modifiedCount} agents`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
