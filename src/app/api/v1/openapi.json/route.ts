import { NextResponse } from "next/server";

const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Fidence Agent API",
    version: "1.0.0",
    description: "Merchant API for agent payment flows.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Workspace, admin, or agent API key",
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/agents/register": { post: { summary: "Register an agent" } },
    "/agents/wallet": { post: { summary: "Register agent wallet" } },
    "/agents/wallet/verify": { post: { summary: "Verify agent wallet signature" } },
    "/agents/profile": { get: { summary: "Get agent profile" } },
    "/agents/{agentId}": { patch: { summary: "Enable or disable agent" } },
    "/agents/{agentId}/transactions": { get: { summary: "List agent transactions" } },
    "/payment-links": {
      get: { summary: "List payment links" },
      post: { summary: "Create payment link" },
    },
    "/payment-links/{linkId}": { get: { summary: "Get payment link by publicId" } },
    "/pay/preflight": { get: { summary: "Preflight pay policy check" } },
    "/pay": { post: { summary: "Record agent payment" } },
    "/webhooks": {
      get: { summary: "List webhook endpoints" },
      post: { summary: "Create webhook endpoint" },
    },
    "/webhooks/{id}": {
      patch: { summary: "Update webhook endpoint" },
      delete: { summary: "Delete webhook endpoint" },
    },
    "/webhooks/{id}/test": { post: { summary: "Send test webhook event" } },
    "/compliance/approvals": { get: { summary: "List payment approvals" } },
    "/compliance/approvals/{id}": { get: { summary: "Get approval" } },
    "/compliance/approvals/{id}/approve": { post: { summary: "Approve payment" } },
    "/compliance/approvals/{id}/reject": { post: { summary: "Reject payment" } },
    "/compliance/agents": { get: { summary: "List agents with policy status" } },
    "/compliance/agents/{agentId}/policy": {
      get: { summary: "Get agent policy" },
      put: { summary: "Update agent policy" },
    },
    "/compliance/agents/{agentId}/decisions": { get: { summary: "List policy decisions" } },
    "/compliance/audit": { get: { summary: "Query compliance audit log" } },
    "/compliance/catalog": { get: { summary: "Get compliance catalog" } },
    "/invoices": { post: { summary: "Create invoice with payment link" } },
    "/invoices/{id}": { get: { summary: "Get invoice status" } },
  },
} as const;

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC);
}
