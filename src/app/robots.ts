import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/sign-in", "/sign-up", "/leaderboard"],
        disallow: [
          "/dashboard",
          "/settings",
          "/wallets",
          "/payment-links",
          "/transactions",
          "/rewards",
          "/referrals",
          "/merchant",
          "/activity",
          "/invoice",
          "/manage-invoices",
          "/api/",
        ],
      },
    ],
    sitemap: "https://www.payagent.co/sitemap.xml",
  };
}
