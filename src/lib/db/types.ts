import type { ObjectId } from "mongodb";

export type AuthProviderType = "google" | "wallet";

export type AuthProvider = {
  type: AuthProviderType;
  providerId: string;
  email?: string;
};

export type UserProfile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
};

export type UserDoc = {
  _id: ObjectId;
  email?: string;
  name: string;
  username?: string;
  profile?: UserProfile;
  initials: string;
  role: "owner" | "admin" | "member";
  authProviders: AuthProvider[];
  walletAddresses: string[];
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceDoc = {
  _id: ObjectId;
  name: string;
  slug: string;
  ownerId: ObjectId;
  plan: "free" | "enterprise";
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMemberDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  userId: ObjectId;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
};

export type SessionDoc = {
  _id: ObjectId;
  token: string;
  userId: ObjectId;
  workspaceId: ObjectId;
  authMethod: AuthProviderType;
  walletAddress?: string;
  expiresAt: Date;
  createdAt: Date;
};

export type PaymentLinkStatus = "pending" | "paid" | "expired" | "cancelled";

export type PaymentLinkDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  createdBy: ObjectId;
  invoiceId?: ObjectId;
  username: string;
  publicId: string;
  slug: string;
  url: string;
  amount: number;
  tokenId: string;
  networkId: string;
  recipientAddress?: string;
  status: PaymentLinkStatus;
  expiresAt: Date;
  paidAt?: Date;
  paidBy?: string;
  paidTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  paymentLinkId?: ObjectId;
  type: "payment_received" | "payout" | "refund";
  label: string;
  amount: number;
  symbol: string;
  networkId?: string;
  txHash?: string;
  status: "pending" | "confirmed" | "failed";
  occurredAt: Date;
  createdAt: Date;
};

export type BalanceDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  tokenId: string;
  label: string;
  amount: number;
  updatedAt: Date;
};

export type ActivityStatus = "settled" | "blocked";

export type ActivityEventDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  type: string;
  summary: string;
  meta: string;
  status?: ActivityStatus;
  occurredAt: Date;
  createdAt: Date;
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export type InvoiceFieldsDoc = {
  companyDetails: {
    logo?: string | null;
    logoBase64?: string;
    signature?: string | null;
    signatureBase64?: string;
    name: string;
    address: string;
    metadata: Array<{ label: string; value: string }>;
  };
  clientDetails: {
    name: string;
    address: string;
    metadata: Array<{ label: string; value: string }>;
  };
  invoiceDetails: {
    theme: {
      baseColor: string;
      mode: "dark" | "light";
      template?: "default" | "vercel";
      font?: "inter" | "geist";
    };
    currency: string;
    prefix: string;
    serialNumber: string;
    date: Date;
    dueDate?: Date | null;
    paymentTerms: string;
    billingDetails: Array<{
      label: string;
      value: number;
      type: "fixed" | "percentage";
    }>;
  };
  items: Array<{
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  metadata: {
    notes: string;
    terms: string;
    paymentInformation: Array<{ label: string; value: string }>;
  };
  paymentLink: {
    tokenId: string;
    networkId: string;
  };
};

export type InvoiceDoc = {
  _id: ObjectId;
  workspaceId: ObjectId;
  createdBy: ObjectId;
  status: InvoiceStatus;
  reference: string;
  fields: InvoiceFieldsDoc;
  paymentLinkId?: ObjectId;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionContext = {
  session: SessionDoc;
  user: UserDoc;
  workspace: WorkspaceDoc;
};

export type DashboardOverview = {
  metrics: {
    totalLinks: number;
    completedLinks: number;
    pendingLinks: number;
    receivedAmount: number;
    rewardsAmount: number;
    sparklines: {
      links: number[];
      completed: number[];
      pending: number[];
      received: number[];
      rewards: number[];
    };
  };
  paymentLinks: Array<{
    id: string;
    amount: string;
    status: PaymentLinkStatus;
    url: string;
    publicId: string;
  }>;
  transactions: Array<{
    id: string;
    label: string;
    date: string;
    amount: string;
  }>;
  activities: Array<{
    id: string;
    summary: string;
    meta: string;
    status?: ActivityStatus;
    type: string;
  }>;
  balances: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  workspace: {
    name: string;
    slug: string;
    paymentLink: string;
  };
  user: {
    name: string;
    role: string;
    initials: string;
  };
};
