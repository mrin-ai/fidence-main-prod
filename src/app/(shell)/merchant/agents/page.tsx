import { AgentsPageContent } from "@/components/merchant/agents-page-content";
import { listWorkspaceAgents, MAX_AGENTS_PER_WORKSPACE } from "@/lib/db/agents";
import { requireShellSession } from "@/lib/shell-session";

export default async function RegisteredAgentsPage() {
  const { session } = await requireShellSession("/merchant/agents");
  const agents = await listWorkspaceAgents(session.workspace._id);

  return (
    <AgentsPageContent
      agents={agents}
      maxAgents={MAX_AGENTS_PER_WORKSPACE}
    />
  );
}
