import { getAgentE2eConfig, merchantFetch, pass, fail, skip } from "./helpers";

export async function runPhase3Tests() {
  const config = getAgentE2eConfig();
  if (!config.apiKey) {
    skip("PAYAGENT_API_KEY not set — skipping Phase 3");
    return;
  }

  const blocked = await merchantFetch("/api/v1/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url: "http://127.0.0.1:8080/hook",
      events: ["payment_link.paid"],
    }),
  });

  if (blocked.response.status !== 400) {
    fail(`Expected 400 for private webhook URL, got ${blocked.response.status}`);
  }
  const blockedBody = blocked.data as { code?: string };
  if (blockedBody.code !== "WEBHOOK_URL_FORBIDDEN") {
    fail(`Expected WEBHOOK_URL_FORBIDDEN, got ${blockedBody.code}`);
  }
  pass("POST /api/v1/webhooks rejects private/reserved URLs");

  const list = await merchantFetch("/api/v1/webhooks");
  if (!list.response.ok) {
    fail(`GET /api/v1/webhooks failed: ${list.response.status}`);
  }
  pass("GET /api/v1/webhooks");
}
