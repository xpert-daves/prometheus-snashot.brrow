import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_COPY_ROOTS = ["src", "public/portfolio/portfolio.json"] as const;
const INCLUDED_EXTENSIONS = new Set([".json", ".md", ".mdx", ".ts", ".tsx"]);
const EXCLUDED_PATH_PARTS = [
  "/__tests__/",
  "/app/privacy-policy/",
  "/app/terms-and-conditions/",
] as const;
const EXCLUDED_FILES = new Set([
  // This boundary contains the phrases it removes from CRM-fed public copy.
  "src/lib/publicProjectCopy.ts",
]);

const BLOCKED_PHRASES = [
  /\bfree[-\s]+delivery\b/i,
  /\bprojects delivered\b/i,
  /\bsite-built or delivered\b/i,
  /\bdelivered across\b/i,
  /\bdelivery radius\b/i,
  /\bdelivery (?:area|assumptions|coverage|details|guidance|timing|zip)\b/i,
  /\bschedule delivery\b/i,
  /\bdelivery & contact\b/i,
  /\brecent installs\b/i,
  /\bpublished installs?\b/i,
  /\bcompleted shed210 install\b/i,
  /\bcustom shed installations?\b/i,
  /\bone-day (?:custom shed )?install(?:ation)?\b/i,
  /\binstalled in\b/i,
] as const;

function collectPublicCopyFiles(relativePath: string): string[] {
  const absolutePath = path.join(process.cwd(), relativePath);
  const normalizedPath = `/${relativePath.replaceAll("\\", "/")}/`;

  if (EXCLUDED_PATH_PARTS.some((part) => normalizedPath.includes(part))) {
    return [];
  }

  const entries = readdirSync(absolutePath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return collectPublicCopyFiles(childPath);
    return INCLUDED_EXTENSIONS.has(path.extname(entry.name)) ? [childPath] : [];
  });
}

function resolvePublicCopyFiles(): string[] {
  return PUBLIC_COPY_ROOTS.flatMap((relativePath) => {
    const absolutePath = path.join(process.cwd(), relativePath);
    return path.extname(absolutePath)
      ? EXCLUDED_FILES.has(relativePath)
        ? []
        : [relativePath]
      : collectPublicCopyFiles(relativePath).filter(
          (file) => !EXCLUDED_FILES.has(file)
        );
  });
}

describe("public build language", () => {
  it("does not frame on-site shed builds as finished-building delivery or installs", () => {
    const violations = resolvePublicCopyFiles().flatMap((relativePath) => {
      const content = readFileSync(path.join(process.cwd(), relativePath), "utf8");
      return BLOCKED_PHRASES.filter((pattern) => pattern.test(content)).map(
        (pattern) => `${relativePath}: /${pattern.source}/`,
      );
    });

    expect(violations).toEqual([]);
  });

  it("keeps service-area copy focused on crews, materials, and build access", () => {
    const relativePath = "src/lib/serviceAreas.ts";
    const content = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    const violations = content
      .split("\n")
      .flatMap((line, index) =>
        /\b(?:delivery|delivered|unload(?:ed|ing)?)\b/i.test(line)
          ? [`${relativePath}:${index + 1}: ${line.trim()}`]
          : []
      );

    expect(violations).toEqual([]);
  });
});
