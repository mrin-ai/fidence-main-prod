import {
  COMPLIANCE_NETWORKS,
  COMPLIANCE_TOKENS,
} from "@/lib/compliance/types";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function withKeys<T extends { id: string; label: string }>(items: readonly T[]) {
  return items.map((item, index) => ({
    id: item.id,
    label: item.label,
    key: LETTERS[index] ?? String(index),
  }));
}

export function getComplianceCatalog() {
  return {
    networks: withKeys(COMPLIANCE_NETWORKS),
    tokens: withKeys(COMPLIANCE_TOKENS),
    actions: [
      { id: "create_payment_links", label: "Create payment links", key: "a" },
      { id: "pay", label: "Pay links / profiles", key: "b" },
    ],
    limits: {
      amountUnit: "USD",
      fields: [
        "maxAmountPerPayment",
        "dailySpendCap",
        "monthlySpendCap",
        "requireApprovalAbove",
      ],
    },
  };
}

export function isCatalogNetworkId(id: string) {
  return COMPLIANCE_NETWORKS.some((n) => n.id === id);
}

export function isCatalogTokenId(id: string) {
  return COMPLIANCE_TOKENS.some((t) => t.id === id);
}
