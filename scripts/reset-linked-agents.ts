import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getDb } from "../src/lib/db/client";
import { COLLECTIONS } from "../src/lib/db/collections";

async function main() {
  const db = await getDb();
  const linked = await db
    .collection(COLLECTIONS.agents)
    .find({ registrationSource: "linked" })
    .toArray();
  const agentIds = linked.map((agent) => agent._id);

  console.log(
    "Linked agents:",
    linked.map((agent) => ({
      id: agent._id.toString(),
      name: agent.name,
      platform: agent.platform,
    })),
  );

  if (agentIds.length) {
    const policies = await db
      .collection(COLLECTIONS.agentPolicies)
      .deleteMany({ agentId: { $in: agentIds } });
    const keys = await db.collection(COLLECTIONS.apiKeys).deleteMany({
      agentId: { $in: agentIds },
      keyPrefix: "fid_agent_",
    });
    const agents = await db
      .collection(COLLECTIONS.agents)
      .deleteMany({ _id: { $in: agentIds } });
    console.log(
      `Deleted policies: ${policies.deletedCount}, scoped keys: ${keys.deletedCount}, agents: ${agents.deletedCount}`,
    );
  } else {
    console.log("No linked agents found");
  }

  const sessions = await db.collection(COLLECTIONS.agentLinkSessions).deleteMany({});
  console.log(`Cleared link sessions: ${sessions.deletedCount}`);

  const configPath = join(homedir(), ".fidence/config.json");
  if (existsSync(configPath)) {
    unlinkSync(configPath);
    console.log(`Removed CLI config: ${configPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
