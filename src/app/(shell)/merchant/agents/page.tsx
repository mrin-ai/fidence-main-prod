import { AgentsPageContent } from "@/components/merchant/agents-page-content";
import { listWorkspaceAgents, MAX_AGENTS_PER_WORKSPACE } from "@/lib/db/agents";
import { getSessionFromCookies } from "@/lib/db/auth";

export default async function RegisteredAgentsPage() {
  const session = await getSessionFromCookies();
  if (!session) return null;

  const agents = await listWorkspaceAgents(session.workspace._id);

  return (
    <AgentsPageContent
      agents={agents}
      maxAgents={MAX_AGENTS_PER_WORKSPACE}
    />
  );
}
