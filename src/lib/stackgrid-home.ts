import fs from "fs";
import path from "path";

import { sanitizeStackgridHtml } from "@/lib/sanitize-html";
import { LANDING_ACCESS_HREF } from "@/lib/landing-access-cta";

export function getStackgridHomeHtml() {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public/stackgrid/content.html"),
    "utf8",
  );

  const inner = raw
    .replace(/^<div class="stackgrid-root"[^>]*>/, "")
    .replace(/<\/div>\s*$/, "");

  return sanitizeStackgridHtml(inner).replace(
    'data-framer-name="Primary" data-highlight="true" href="/"',
    `data-framer-name="Primary" data-highlight="true" href="${LANDING_ACCESS_HREF}"`,
  );
}
