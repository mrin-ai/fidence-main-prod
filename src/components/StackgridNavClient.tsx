"use client";

import { useEffect } from "react";
import { initBrandLogo } from "@/lib/brand-logo";
import { wireAccessNowLinks } from "@/lib/landing-access-cta";

export function StackgridNavClient() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".stackgrid-site-nav");
    if (!root) return;

    const cleanup = initBrandLogo(root);
    wireAccessNowLinks(root);

    const cleanups: Array<() => void> = [cleanup];

    root.querySelectorAll('a[href^="/#"], a[href^="#"]').forEach((link) => {
      const handler = (e: Event) => {
        const href = (link as HTMLAnchorElement).getAttribute("href");
        if (!href?.includes("#")) return;
        const id = href.replace(/^\/?#/, "");
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth" });
        }
      };
      link.addEventListener("click", handler);
      cleanups.push(() => link.removeEventListener("click", handler));
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
