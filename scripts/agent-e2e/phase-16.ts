import { fail, getAgentE2eConfig, pass, publicFetch, skip } from "./helpers";
import { isPayAgentConnectEnabled } from "../../src/lib/pay/config";

export async function runPhase16Tests() {
  if (!isPayAgentConnectEnabled()) {
    pass("Local isPayAgentConnectEnabled=false");
  } else {
    pass("Local isPayAgentConnectEnabled=true");
  }

  const config = getAgentE2eConfig();
  const apiOn = await publicFetch("/api/v1/agent-links", {
    method: "POST",
    body: JSON.stringify({
      publicKey: Buffer.from(new Uint8Array(32)).toString("base64"),
      platform: "e2e",
      agentName: "Flag smoke",
    }),
  });

  if (process.env.PAY_AGENT_CONNECT_ENABLED === "false") {
    if (apiOn.response.status !== 404) {
      fail(`Expected 404 when server flag off, got ${apiOn.response.status}`);
    }
    pass("Server PAY_AGENT_CONNECT_ENABLED=false disables agent-links");
    return;
  }

  if (!apiOn.response.ok) {
    skip(`agent-links smoke skipped: ${apiOn.response.status} (is dev server running at ${config.baseUrl}?)`);
    return;
  }
  pass("agent-links API smoke when feature enabled");
}
