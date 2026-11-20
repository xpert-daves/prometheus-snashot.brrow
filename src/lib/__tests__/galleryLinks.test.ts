/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

const INTERNAL_LINK_SOURCES = [
  "src/lib/navLinks.ts",
  "src/components/Footer.tsx",
  "src/components/PortfolioSection.tsx",
  "src/components/hero.tsx",
  "src/components/LocalProjectsSection.tsx",
  "src/app/service-area/[city]/page.tsx",
  "src/app/news/[slug]/page.tsx",
  "src/articles/sanantonio_shed_guide.md",
  "src/articles/san-antonio-shed-cost-guide.mdx",
] as const;

describe("canonical gallery internal links", () => {
  it.each(INTERNAL_LINK_SOURCES)("%s links to /gallery, never /our-work", (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).toContain("/gallery");
    expect(source).not.toMatch(/(?:href=["']|]\()\/our-work(?:[#?/"'])/);
  });

  it("uses /gallery as the live built-site crawl priority", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/crawl-built-site.mjs"),
      "utf8"
    );
    expect(source).toContain('"/gallery"');
    expect(source).not.toContain('"/our-work"');
  });
});
