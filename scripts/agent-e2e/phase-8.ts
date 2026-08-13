import { fail, pass, publicFetch, skip } from "./helpers";

export async function runPhase8Tests() {
  const create = await publicFetch("/api/v1/agent-links", {
    method: "POST",
    body: JSON.stringify({
      publicKey: Buffer.from(new Uint8Array(32)).toString("base64"),
      platform: "e2e",
      agentName: "E2E Agent",
    }),
  });

  if (!create.response.ok) {
    fail(`Create agent link failed: ${create.response.status}`);
  }

  const body = create.data as {
    linkId?: string;
    pollSecret?: string;
  };

  if (!body.linkId || !body.pollSecret) {
    fail("Create agent link missing linkId or pollSecret");
  }
  pass("POST /api/v1/agent-links");

  const pollPending = await publicFetch(
    `/api/v1/agent-links/${body.linkId}?pollSecret=${encodeURIComponent(body.pollSecret)}`,
  );
  if (!pollPending.response.ok) {
    fail(`Poll pending failed: ${pollPending.response.status}`);
  }
  const pollBody = pollPending.data as { status?: string };
  if (pollBody.status !== "pending") {
    fail(`Expected pending poll status, got ${pollBody.status}`);
  }
  pass("GET /api/v1/agent-links/:lid poll pending");

  const badPoll = await publicFetch(
    `/api/v1/agent-links/${body.linkId}?pollSecret=invalid`,
  );
  if (badPoll.response.status !== 403) {
    fail(`Invalid poll secret should 403, got ${badPoll.response.status}`);
  }
  pass("Invalid poll secret rejected");

  if (!process.env.AGENT_E2E_SESSION_TOKEN) {
    skip("AGENT_E2E_SESSION_TOKEN not set — skipping approve flow");
    return;
  }

  const { sessionFetch } = await import("./helpers");
  const approve = await sessionFetch(`/api/pay/link-sessions/${body.linkId}`, {
    method: "POST",
    body: JSON.stringify({ action: "approve" }),
  });

  if (!approve.response.ok) {
    fail(`Approve link failed: ${approve.response.status} ${JSON.stringify(approve.data)}`);
  }
  pass("POST /api/pay/link-sessions/:lid approve");

  const pollApproved = await publicFetch(
    `/api/v1/agent-links/${body.linkId}?pollSecret=${encodeURIComponent(body.pollSecret)}`,
  );
  const approvedBody = pollApproved.data as { status?: string; apiKey?: string };
  if (approvedBody.status !== "approved") {
    fail(`Expected approved poll status, got ${approvedBody.status}`);
  }
  if (!approvedBody.apiKey?.startsWith("fid_agent_")) {
    fail("Scoped agent key not returned on approved poll");
  }
  pass("Poll returns scoped fid_agent_ key once");
}
