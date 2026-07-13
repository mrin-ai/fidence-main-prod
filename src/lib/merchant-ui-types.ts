export type ApiKeyOverview = {
  hasKey: boolean;
  maskedKey: string | null;
  keyLast4: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export type AgentListItem = {
  id: string;
  publicId: string;
  externalAgentId: string;
  name: string;
  walletAddress: string | null;
  networkId: string | null;
  walletCount: number;
  status: "active" | "inactive";
  linksCreated: number;
  amountPaid: number;
  amountReceived: number;
  registeredAtLabel: string;
  lastActiveAtLabel: string;
};
