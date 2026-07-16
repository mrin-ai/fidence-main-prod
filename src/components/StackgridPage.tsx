"use client";

import { useEffect, useRef } from "react";
import { initBrandLogo } from "@/lib/brand-logo";
import { initFaqAccordion } from "@/lib/faq-accordion";
import { initBlogInsights } from "@/lib/blog-insights";
import { initFeatureSvgIcons } from "@/lib/feature-svg-icon";
import { initAllAsciiImages } from "@/lib/ascii-image";
import { initAllAsciiVideos } from "@/lib/ascii-video";
import { initScrollAnimations } from "@/lib/scroll-animations";
import { wireAccessNowLinks } from "@/lib/landing-access-cta";

type Props = {
  html: string;
};

function setupInteractions(root: HTMLElement) {
  const cleanups: Array<() => void> = [];

  const destroyAsciiVideos = initAllAsciiVideos(root);
  cleanups.push(destroyAsciiVideos);

  const destroyFeatureSvgIcons = initFeatureSvgIcons(root);
  cleanups.push(destroyFeatureSvgIcons);

  const destroyBlogInsights = initBlogInsights(root);
  cleanups.push(destroyBlogInsights);

  const destroyFaqAccordion = initFaqAccordion(root);
  cleanups.push(destroyFaqAccordion);

  const destroyBrandLogo = initBrandLogo(root);
  cleanups.push(destroyBrandLogo);

  let destroyAsciiImages = () => {};
  void initAllAsciiImages(root).then((destroy) => {
    destroyAsciiImages = destroy;
  });
  cleanups.push(() => destroyAsciiImages());

  root.querySelectorAll(".framer-HcaMc ul").forEach((list) => {
    (list as HTMLElement).style.animation =
      "stackgrid-marquee 40s linear infinite";
  });

  wireAccessNowLinks(root);

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
}

export function StackgridPage({ html }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      root.innerHTML = html;
      const destroyScrollAnimations = initScrollAnimations(root);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) {
            const destroyInteractions = setupInteractions(root);
            cleanup = () => {
              destroyScrollAnimations();
              destroyInteractions();
            };
          }
        });
      });
    };

    const styleLinkId = "stackgrid-styles";
    const themeLinkId = "stackgrid-theme";
    const existing = document.getElementById(styleLinkId) as HTMLLinkElement | null;

    const loadTheme = () => {
      if (document.getElementById(themeLinkId)) {
        init();
        return;
      }
      const themeLink = document.createElement("link");
      themeLink.id = themeLinkId;
      themeLink.rel = "stylesheet";
      themeLink.href = "/stackgrid/theme.css";
      themeLink.addEventListener("load", init);
      document.head.appendChild(themeLink);
      if (themeLink.sheet) init();
    };

    if (existing?.sheet) {
      loadTheme();
    } else {
      const link = existing ?? document.createElement("link");
      if (!existing) {
        link.id = styleLinkId;
        link.rel = "stylesheet";
        link.href = "/stackgrid/styles.css";
        document.head.appendChild(link);
      }
      link.addEventListener("load", loadTheme);
      if (link.sheet) loadTheme();
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [html]);

  return (
    <div
      id="stackgrid-root"
      className="stackgrid-root"
      ref={ref}
      style={{ minHeight: "100vh", background: "#ffffff" }}
    />
  );
}
