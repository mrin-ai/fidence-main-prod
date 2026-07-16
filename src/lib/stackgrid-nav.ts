import fs from "fs";
import path from "path";
import { sanitizeStackgridHtml } from "@/lib/sanitize-html";

const NAV_START =
  '<div class="ssr-variant hidden-1xn8rl8"><div class="framer-sfzdwg-container">';

function prepareNavHtml(html: string): string {
  return sanitizeStackgridHtml(html)
    .replace(/\bhidden-[a-z0-9]+\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getStackgridNavHtml(): string {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public/stackgrid/content.html"),
    "utf8"
  );

  const start = raw.indexOf(NAV_START);
  if (start < 0) return "";

  const navEnd = raw.indexOf("</nav>", start) + "</nav>".length;
  const end =
    raw.indexOf("</div></div></div>", navEnd) + "</div></div></div>".length;

  return prepareNavHtml(raw.slice(start, end));
}
