/**
 * Check MongoDB connectivity and connection pool headroom.
 *
 * Remote (from laptop / CI):
 *   MONGODB_URI='mongodb://fidence_app:...@host:27017/fidence?authSource=fidence' npx tsx scripts/check-mongo-connections.ts
 *
 * On Hetzner server (full stats — run via SSH):
 *   mongosh --quiet --eval "
 *     const s = db.serverStatus();
 *     print('current:', s.connections.current);
 *     print('available:', s.connections.available);
 *     print('totalCreated:', s.connections.totalCreated);
 *   "
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MongoClient } from "mongodb";

function loadProductionUri() {
  if (process.env.MONGODB_URI?.includes("167.233.72.149")) {
    return process.env.MONGODB_URI;
  }

  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const match = env.match(/^#\s*MONGODB_URI=(mongodb:\/\/[^\n]+)/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const uri = loadProductionUri();
  if (!uri) {
    console.error(
      "Set MONGODB_URI to your Hetzner connection string, or add a commented production URI in .env.local",
    );
    process.exit(1);
  }

  const host = uri.match(/@([^/?:]+)/)?.[1] ?? "unknown";
  console.log(`Target: ${host}`);
  console.log("");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "fidence");

    const ping = await db.command({ ping: 1 });
    console.log("✓ Connected and authenticated");
    console.log(`  ping: ${ping.ok === 1 ? "ok" : "failed"}`);

    const cs = await db.command({ connectionStatus: 1 });
    const roles = cs.authInfo.authenticatedUserRoles ?? [];
    console.log(`  user roles: ${roles.map((r: { role: string; db: string }) => `${r.role}@${r.db}`).join(", ")}`);

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    console.log(`  database: fidence (${collections.length} collections)`);

    try {
      const status = await db.admin().command({ serverStatus: 1 });
      const c = status.connections;
      console.log("");
      console.log("Connection stats (serverStatus):");
      console.log(`  current:        ${c.current}`);
      console.log(`  available:      ${c.available}`);
      console.log(`  totalCreated:   ${c.totalCreated}`);
      console.log("");

      if (c.available > 200) {
        console.log("Headroom: GOOD — plenty of connections for launch");
      } else if (c.available > 50) {
        console.log("Headroom: OK — fine for launch, monitor under load");
      } else {
        console.log("Headroom: LOW — raise net.maxIncomingConnections on Hetzner");
      }
    } catch {
      console.log("");
      console.log("✗ serverStatus not permitted for this user (readWrite only)");
      console.log("");
      console.log("To get full stats, SSH into Hetzner and run:");
      console.log(`  ssh root@${host}`);
      console.log('  mongosh --quiet --eval "const s=db.serverStatus(); print(\'current:\', s.connections.current); print(\'available:\', s.connections.available); print(\'totalCreated:\', s.connections.totalCreated);"');
      console.log("");
      console.log("Or grant read-only monitoring to fidence_app (on server, as admin):");
      console.log("  use admin");
      console.log("  db.grantRolesToUser('fidence_app', [{ role: 'clusterMonitor', db: 'admin' }])");
    }
  } catch (error) {
    console.error("✗ Connection failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
