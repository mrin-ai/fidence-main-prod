import fs from "fs";
import path from "path";

const ARTICLES_DIR = path.join(process.cwd(), "content/blog/articles");

export function getArticleHtml(slug: string): string | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.html`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

export function articleExists(slug: string): boolean {
  return fs.existsSync(path.join(ARTICLES_DIR, `${slug}.html`));
}
