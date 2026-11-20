jest.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: <T,>(config: T) => config,
}));

import {
  areCrmProjectImagesV3Required,
  CRM_PROJECT_IMAGES_V3_REQUIRED_ENV_NAME,
  CRM_PROJECTS_ENV_NAME,
  getCrmProjectImageRemotePattern,
  getCrmProjectsUrl,
  parseCrmProjectsUrl,
} from "@/lib/projectsConfig";
import {
  buildImageRemotePatterns,
  buildProjectImageOptimizationLimits,
} from "../../../next.config";

describe("CRM projects configuration", () => {
  const crmUrl = "https://youthful-horse-290.convex.cloud";

  it("normalizes the configured HTTPS origin", () => {
    expect(parseCrmProjectsUrl(`${crmUrl}/`)).toBe(crmUrl);
    expect(
      getCrmProjectsUrl({
        FRONTIER_PIXEL_CRM_CONVEX_URL: crmUrl,
      })
    ).toBe(crmUrl);
  });

  it("does not fall back to the website quote Convex URL", () => {
    expect(() =>
      getCrmProjectsUrl({
        FRONTIER_PIXEL_CRM_CONVEX_URL: undefined,
        NEXT_PUBLIC_CONVEX_URL: "https://site-quotes.convex.cloud",
      })
    ).toThrow(`${CRM_PROJECTS_ENV_NAME} is not configured`);
  });

  it.each([
    "http://youthful-horse-290.convex.cloud",
    "https://user:pass@youthful-horse-290.convex.cloud",
    "https://youthful-horse-290.convex.cloud:444",
    "https://youthful-horse-290.convex.cloud/projects",
    "https://youthful-horse-290.convex.cloud?deployment=other",
    "https://youthful-horse-290.convex.cloud#projects",
  ])("rejects a non-origin CRM URL: %s", (value) => {
    expect(() => parseCrmProjectsUrl(value)).toThrow(
      /must be an HTTPS origin/
    );
  });

  it("builds one exact Next Image remote pattern from the CRM deployment", () => {
    const env = {
      FRONTIER_PIXEL_CRM_CONVEX_URL: crmUrl,
    };

    expect(getCrmProjectImageRemotePattern(env)).toEqual({
      protocol: "https",
      hostname: "youthful-horse-290.convex.cloud",
      port: "",
      pathname: "/**",
    });
    expect(buildImageRemotePatterns(env)).toEqual([
      {
        protocol: "https",
        hostname: "youthful-horse-290.convex.cloud",
        port: "",
        pathname: "/**",
      },
    ]);
  });

  it("does not add a broad or guessed remote image host when config is absent", () => {
    expect(
      getCrmProjectImageRemotePattern({
        FRONTIER_PIXEL_CRM_CONVEX_URL: undefined,
      })
    ).toBeNull();
    expect(
      buildImageRemotePatterns({
        FRONTIER_PIXEL_CRM_CONVEX_URL: undefined,
      })
    ).toEqual([]);
  });

  it("keeps the 31-day image cache without enforcing the 3 MB cap during fallback", () => {
    const env = { CRM_PROJECT_IMAGES_V3_REQUIRED: "false" };

    expect(areCrmProjectImagesV3Required(env)).toBe(false);
    expect(buildProjectImageOptimizationLimits(env)).toEqual({
      minimumCacheTTL: 2_678_400,
    });
  });

  it("enables the 3 MB cap only when derivative-only V3 is explicitly required", () => {
    const env = { CRM_PROJECT_IMAGES_V3_REQUIRED: "true" };

    expect(areCrmProjectImagesV3Required(env)).toBe(true);
    expect(buildProjectImageOptimizationLimits(env)).toEqual({
      minimumCacheTTL: 2_678_400,
      maximumResponseBody: 3_000_000,
    });
  });

  it("rejects ambiguous derivative rollout flag values", () => {
    expect(() =>
      areCrmProjectImagesV3Required({
        CRM_PROJECT_IMAGES_V3_REQUIRED: "TRUE",
      })
    ).toThrow(
      `${CRM_PROJECT_IMAGES_V3_REQUIRED_ENV_NAME} must be exactly "true" or "false"`
    );
  });
});
