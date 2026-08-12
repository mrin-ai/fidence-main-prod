/**
 * Validate docs/openapi/agent-v1.yaml against src/app/api/v1 route files.
 *
 * Usage:
 *   npm run validate:openapi
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SPEC_PATH = resolve(ROOT, "docs/openapi/agent-v1.yaml");
const V1_API_DIR = resolve(ROOT, "src/app/api/v1");

function collectRoutePaths(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const paths: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const segment = entry.startsWith("[") && entry.endsWith("]")
        ? `{${entry.slice(1, -1)}}`
        : entry;
      paths.push(...collectRoutePaths(fullPath, `${prefix}/${segment}`));
      continue;
    }

    if (entry === "route.ts") {
      paths.push(prefix || "/");
    }
  }

  return paths.sort();
}

function parseOpenApiPaths(specSource: string) {
  const paths = new Set<string>();
  const lines = specSource.split("\n");
  let inPaths = false;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths && /^[^\s].+/.test(line) && !line.startsWith(" ")) {
      break;
    }
    const match = line.match(/^ {2}(\/[^\s:]+):\s*$/);
    if (match) {
      paths.add(match[1]);
    }
  }

  return paths;
}

function main() {
  const specSource = readFileSync(SPEC_PATH, "utf8");
  if (!specSource.includes("openapi:")) {
    console.error("FAIL: missing openapi version header");
    process.exit(1);
  }

  const specPaths = parseOpenApiPaths(specSource);
  const routePaths = new Set(
    collectRoutePaths(V1_API_DIR).map((routePath) =>
      routePath === "/" ? "" : routePath,
    ),
  );

  const missingInSpec = [...routePaths].filter((routePath) => !specPaths.has(routePath));
  const extraInSpec = [...specPaths].filter((routePath) => !routePaths.has(routePath));

  if (missingInSpec.length > 0) {
    console.error("FAIL: routes missing from OpenAPI spec:");
    for (const routePath of missingInSpec) {
      console.error(`  - ${routePath || "/"}`);
    }
  }

  if (extraInSpec.length > 0) {
    console.error("FAIL: OpenAPI paths not found in codebase:");
    for (const routePath of extraInSpec) {
      console.error(`  - ${routePath}`);
    }
  }

  if (missingInSpec.length > 0 || extraInSpec.length > 0) {
    process.exit(1);
  }

  console.log(`OK: OpenAPI spec covers ${specPaths.size} v1 routes`);
  console.log(`    spec: ${relative(ROOT, SPEC_PATH)}`);
  console.log(`    api:  ${relative(ROOT, V1_API_DIR)}`);
}

main();
