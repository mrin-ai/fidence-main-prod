import { fail, pass, sessionFetch, skip } from "./helpers";

export async function runPhase9Tests() {
  if (!process.env.AGENT_E2E_SESSION_TOKEN) {
    skip("AGENT_E2E_SESSION_TOKEN not set — skipping saved addresses");
    return;
  }

  const invalid = await sessionFetch("/api/pay/saved-addresses", {
    method: "POST",
    body: JSON.stringify({ name: "", line1: "", city: "", country: "X" }),
  });
  if (invalid.response.ok) {
    fail("Invalid saved address should fail validation");
  }
  pass("Saved address validation");

  const create = await sessionFetch("/api/pay/saved-addresses", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Billing",
      email: "e2e@example.com",
      line1: "1 Test Street",
      city: "Testville",
      country: "US",
    }),
  });
  if (!create.response.ok) {
    fail(`Create saved address failed: ${create.response.status}`);
  }

  const created = create.data as { address?: { id?: string } };
  if (!created.address?.id) {
    fail("Create saved address missing id");
  }
  pass("POST /api/pay/saved-addresses");

  const list = await sessionFetch("/api/pay/saved-addresses");
  if (!list.response.ok) {
    fail(`List saved addresses failed: ${list.response.status}`);
  }
  pass("GET /api/pay/saved-addresses");

  const update = await sessionFetch(`/api/pay/saved-addresses/${created.address.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "E2E Billing Updated",
      line1: "2 Test Street",
      city: "Testville",
      country: "US",
    }),
  });
  if (!update.response.ok) {
    fail(`Update saved address failed: ${update.response.status}`);
  }
  pass("PATCH /api/pay/saved-addresses/:id");

  const del = await sessionFetch(`/api/pay/saved-addresses/${created.address.id}`, {
    method: "DELETE",
  });
  if (!del.response.ok) {
    fail(`Delete saved address failed: ${del.response.status}`);
  }
  pass("DELETE /api/pay/saved-addresses/:id");
}
