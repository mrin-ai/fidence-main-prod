import type { CommerceSource } from "@/lib/db/merchant-types";

export function humanSourceFilter() {
  return {
    $or: [{ source: "human" as CommerceSource }, { source: { $exists: false } }],
  };
}

export function agentSourceFilter() {
  return { source: "agent" as CommerceSource };
}

export function buildCommerceSourceFilter(source?: CommerceSource) {
  if (source === "agent") return agentSourceFilter();
  if (source === "human") return humanSourceFilter();
  return {};
}
