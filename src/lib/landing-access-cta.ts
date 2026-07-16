export const LANDING_ACCESS_HREF = "/sign-in?redirect=/dashboard";

export function wireAccessNowLinks(root: ParentNode) {
  root.querySelectorAll("a").forEach((link) => {
    const label = link.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
    if (label === "access now") {
      link.setAttribute("href", LANDING_ACCESS_HREF);
    }
  });
}
