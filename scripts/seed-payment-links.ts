import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing env file in CI.
  }
}

loadEnvFile();

async function main() {
  const { bootstrapDatabase } = await import("../src/lib/db/seed");
  const { seedPaymentLinksForUserEmail } = await import(
    "../src/lib/db/seed-payment-links"
  );

  await bootstrapDatabase();

  const args = process.argv.slice(2);
  const countArg = args.find((value) => /^\d+$/.test(value));
  const email = args.find((value) => value.includes("@"));
  const count = countArg ? Number(countArg) : 50;

  let resultList;
  if (email) {
    resultList = [await seedPaymentLinksForUserEmail(email, count)];
  } else {
    const { seedPaymentLinksForAllWorkspaces } = await import(
      "../src/lib/db/seed-payment-links"
    );
    resultList = await seedPaymentLinksForAllWorkspaces(count);
  }

  for (const result of resultList) {
    console.log(
      `Seeded ${result.inserted} payment links for ${result.email ?? result.username} (workspace ${result.workspaceId}).`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
