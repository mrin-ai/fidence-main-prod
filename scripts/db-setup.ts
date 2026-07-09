import { bootstrapDatabase } from "../src/lib/db/seed";

async function main() {
  const result = await bootstrapDatabase();
  if (result.skipped) {
    console.log("Migrations already applied — indexes ensured.");
  } else {
    console.log("Migrations applied and indexes ensured.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Database setup failed:", error);
    process.exit(1);
  });
