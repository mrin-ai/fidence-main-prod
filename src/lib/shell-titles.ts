const SHELL_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/wallets": "Wallets",
  "/invoice": "Invoice",
  "/manage-invoices": "Manage Invoices",
  "/activity": "Activity",
  "/payment-links": "Payment links",
  "/referrals": "Referrals",
  "/rewards": "Rewards",
  "/transactions": "Transactions",
  "/settings": "Settings",
  "/merchant/api-credentials": "API Credentials",
  "/merchant/agents": "Registered Agents",
  "/merchant/compliance": "Compliance Engine",
  "/merchant/webhooks": "Webhooks",
};

const HIDDEN_HEADER_PATHS = new Set(["/settings"]);

export function getShellTitle(pathname: string) {
  if (SHELL_TITLES[pathname]) {
    return SHELL_TITLES[pathname];
  }

  if (pathname.startsWith("/merchant/compliance/")) {
    return "Agent Policy";
  }

  if (pathname.startsWith("/merchant/")) {
    return "Merchant Commerce";
  }

  if (pathname.startsWith("/invoice/")) {
    return "Invoice";
  }

  return "Fidence";
}

export function shouldHideShellHeader(pathname: string) {
  return HIDDEN_HEADER_PATHS.has(pathname);
}
