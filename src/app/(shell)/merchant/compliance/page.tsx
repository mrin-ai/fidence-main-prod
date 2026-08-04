import { CompliancePageContent } from "@/components/compliance/compliance-page-content";
import { listWorkspaceAgents } from "@/lib/db/agents";
import { requireShellSession } from "@/lib/shell-session";

export default async function ComplianceEnginePage() {
  const { session } = await requireShellSession("/merchant/compliance");
  const agents = await listWorkspaceAgents(session.workspace._id);

  return <CompliancePageContent agents={agents} />;
}
