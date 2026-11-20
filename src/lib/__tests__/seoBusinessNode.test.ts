import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectSourceFiles(relativePath: string): string[] {
  const entries = readdirSync(path.join(process.cwd(), relativePath), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const childPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(childPath);
    }
    return SOURCE_EXTENSIONS.has(path.extname(entry.name))
      ? [childPath.replaceAll("\\", "/")]
      : [];
  });
}

function filesContaining(pattern: RegExp): string[] {
  return collectSourceFiles("src")
    .filter((file) => pattern.test(readFileSync(path.join(process.cwd(), file), "utf8")))
    .sort();
}

// Every node with the business @id claims to describe the same business. Defining it on
// one page keeps a single set of business facts; other pages use buildBusinessReferenceJsonLd.
describe("business JSON-LD node", () => {
  it("is built only by the homepage", () => {
    expect(filesContaining(/\bbuildServiceAreaBusinessJsonLd\(/)).toEqual([
      "src/app/page.tsx",
      "src/lib/seo.ts",
    ]);
  });

  it("keeps the business @id in the seo helpers instead of hand-written page schema", () => {
    expect(filesContaining(/#localbusiness/)).toEqual(["src/lib/seo.ts"]);
  });
});
