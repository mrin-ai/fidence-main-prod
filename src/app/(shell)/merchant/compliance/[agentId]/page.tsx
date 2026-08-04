import { notFound } from "next/navigation";
import { AgentPolicyForm } from "@/components/compliance/agent-policy-form";
import { listWorkspaceAgents } from "@/lib/db/agents";
import { requireShellSession } from "@/lib/shell-session";

export default async function AgentCompliancePolicyPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const { session } = await requireShellSession(
    `/merchant/compliance/${agentId}`,
  );
  const agents = await listWorkspaceAgents(session.workspace._id);
  const agent = agents.find((item) => item.id === agentId);

  if (!agent) {
    notFound();
  }

  return <AgentPolicyForm agent={agent} />;
}
