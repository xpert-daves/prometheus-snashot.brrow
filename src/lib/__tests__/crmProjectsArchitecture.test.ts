/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("CRM project reader boundaries", () => {
  it("is server-only and references only the approved V3, V2, and rollout V1 project queries", () => {
    const source = readSource("src/lib/crmProjects.server.ts");
    const functionNames = Array.from(
      source.matchAll(
        /projects:public(?:ListProjects|GetProjectBySlug)(?:V[23])?/g
      ),
      (match) => match[0]
    );

    expect(source).toContain('import "server-only"');
    expect(source).toContain('from "convex/server"');
    expect(functionNames).toEqual([
      "projects:publicListProjectsV3",
      "projects:publicGetProjectBySlugV3",
      "projects:publicListProjectsV2",
      "projects:publicGetProjectBySlugV2",
      "projects:publicListProjects",
      "projects:publicGetProjectBySlug",
    ]);
    expect(source).not.toContain("convex/_generated/api");
    expect(source).not.toContain("NEXT_PUBLIC_CONVEX_URL");
  });

  it("keeps the strict project-city query server-only with a fixed tenant boundary", () => {
    const source = readSource("src/lib/crmProjectCities.server.ts");

    expect(source).toContain('import "server-only"');
    expect(source).toContain('from "convex/server"');
    expect(source).toContain('"projects:publicListProjectCitiesV1"');
    expect(source).toContain("CRM_PROJECTS_TENANT_SLUG");
    expect(source).toContain("publicProjectCityListSchema.parse(response)");
    expect(source).toContain("cache(queryCrmProjectCities)");
    expect(source).not.toContain("convex/_generated/api");
    expect(source).not.toContain("NEXT_PUBLIC_CONVEX_URL");
  });

  it("leaves the website quote Convex references on the local generated API", () => {
    const persistenceSource = readSource("src/lib/quotePersistence.ts");
    const rateLimitSource = readSource("src/lib/quoteRateLimit.ts");
    const pricingSource = readSource("src/lib/quotePricingSettings.ts");

    expect(persistenceSource).toContain(
      "api.quoteRequests.create"
    );
    expect(rateLimitSource).toContain(
      "api.quoteRequests.checkQuoteRateLimit"
    );
    expect(pricingSource).toContain(
      "api.quotePricing.getActivePricingForQuoteRoute"
    );
    for (const source of [
      persistenceSource,
      rateLimitSource,
      pricingSource,
    ]) {
      expect(source).toContain("NEXT_PUBLIC_CONVEX_URL");
      expect(source).toMatch(/convex\/_generated\/api/);
    }
  });
});
