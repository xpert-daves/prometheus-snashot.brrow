/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { config, proxy } from "../proxy";

const middleware = proxy;

function buildRequest(
  url: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(url, init);
}

describe("middleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.shed210.com";
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it.each([
    [
      "http://shed210.com/our-work?city=san-antonio",
      "https://www.shed210.com/gallery?city=san-antonio",
    ],
    [
      "https://shed210.com/our-work?city=san-antonio",
      "https://www.shed210.com/gallery?city=san-antonio",
    ],
    [
      "http://www.shed210.com/our-work?city=san-antonio",
      "https://www.shed210.com/gallery?city=san-antonio",
    ],
    [
      "http://shed210.com/our-work/?city=san-antonio",
      "https://www.shed210.com/gallery?city=san-antonio",
    ],
  ])("redirects %s to the canonical gallery in one permanent hop", (requestUrl, expectedUrl) => {
    const response = middleware(buildRequest(requestUrl));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(expectedUrl);
  });

  it("leaves the canonical HTTPS gallery unchanged", () => {
    const response = middleware(
      buildRequest("https://www.shed210.com/gallery?city=san-antonio")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    ["GET", "/our-work"],
    ["GET", "/our-work/"],
    ["HEAD", "/our-work"],
    ["HEAD", "/our-work/"],
  ])("redirects %s %s to /gallery with an exact 301", (method, pathname) => {
    const response = middleware(
      buildRequest(
        `https://www.shed210.com${pathname}?city=schertz&model=Garden%20Shed`,
        { method }
      )
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://www.shed210.com/gallery?city=schertz&model=Garden%20Shed"
    );
  });

  it("does not redirect paths that only begin with our-work", () => {
    const response = middleware(
      buildRequest("https://www.shed210.com/our-workshop?source=current")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    [
      "GET",
      "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling-2?source=gallery",
      "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling?source=gallery",
    ],
    [
      "HEAD",
      "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling-2/?source=head",
      "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling?source=head",
    ],
    [
      "GET",
      "http://shed210.com/projects/luling/16x20x9-side-utility-luling-2/?source=legacy",
      "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling?source=legacy",
    ],
  ])(
    "redirects the legacy Luling project with one exact 301 for %s",
    (method, requestUrl, expectedUrl) => {
      const response = middleware(buildRequest(requestUrl, { method }));

      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(expectedUrl);
    }
  );

  it.each([
    "/projects/luling/16x20x9-side-utility-luling",
    "/projects/luling/16x20x9-side-utility-luling-20",
    "/projects/luling/16x20x9-side-utility-luling-2/photos",
  ])("leaves non-legacy Luling project path %s unchanged", (pathname) => {
    const response = middleware(
      buildRequest(`https://www.shed210.com${pathname}?source=current`)
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "does not redirect the legacy Luling project for the unsafe %s method",
    (method) => {
      const response = middleware(
        buildRequest(
          "https://www.shed210.com/projects/luling/16x20x9-side-utility-luling-2?source=unsafe",
          { method }
        )
      );

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  );

  it.each([
    "/portfolio/IMG_6287.jpeg",
    "/portfolio/project-detail",
  ])("does not redirect retained portfolio path %s", (pathname) => {
    const response = middleware(
      buildRequest(`https://www.shed210.com${pathname}`)
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "does not rewrite /our-work for the unsafe %s method",
    (method) => {
      const response = middleware(
        buildRequest("https://www.shed210.com/our-work?source=unsafe", {
          method,
        })
      );

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  );

  it.each([
    [
      "GET",
      "https://www.shed210.com/gallery/?city=schertz",
      "https://www.shed210.com/gallery?city=schertz",
    ],
    [
      "HEAD",
      "https://www.shed210.com/portfolio/project-detail/?view=full",
      "https://www.shed210.com/portfolio/project-detail?view=full",
    ],
    [
      "POST",
      "https://www.shed210.com/api/quote/?draft=1",
      "https://www.shed210.com/api/quote?draft=1",
    ],
    [
      "DELETE",
      "https://www.shed210.com/our-work/?source=unsafe",
      "https://www.shed210.com/our-work?source=unsafe",
    ],
    [
      "PATCH",
      "https://www.shed210.com/home/?source=unsafe",
      "https://www.shed210.com/home?source=unsafe",
    ],
  ])(
    "normalizes the trailing slash for %s %s with an exact 308",
    (method, requestUrl, expectedUrl) => {
      const response = middleware(buildRequest(requestUrl, { method }));

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(expectedUrl);
    }
  );

  it("combines trailing-slash, protocol, and canonical-host normalization in one hop", () => {
    const response = middleware(
      buildRequest("http://shed210.com/gallery/?city=cibolo")
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.shed210.com/gallery?city=cibolo"
    );
  });

  it("retains slashless normalization for .well-known paths", () => {
    const response = middleware(
      buildRequest(
        "https://www.shed210.com/.well-known/acme-challenge/token/?renew=1"
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.shed210.com/.well-known/acme-challenge/token?renew=1"
    );
  });

  it.each([
    [
      "/robots.txt/?source=slash",
      "https://www.shed210.com/robots.txt?source=slash",
    ],
    [
      "/favicon.ico/?source=slash",
      "https://www.shed210.com/favicon.ico?source=slash",
    ],
    [
      "/sitemap.xml/?source=slash",
      "https://www.shed210.com/sitemap.xml?source=slash",
    ],
    [
      "/_next/static/chunk.js/?source=slash",
      "https://www.shed210.com/_next/static/chunk.js?source=slash",
    ],
    [
      "/_next/image/?url=%2Fhero.jpg",
      "https://www.shed210.com/_next/image?url=%2Fhero.jpg",
    ],
  ])(
    "normalizes a formerly excluded trailing-slash path: %s",
    (pathname, expectedUrl) => {
      const response = middleware(
        buildRequest(`https://www.shed210.com${pathname}`)
      );

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(expectedUrl);
    }
  );

  it("keeps slashless framework and metadata paths out of canonical middleware logic", () => {
    const response = middleware(
      buildRequest("http://shed210.com/robots.txt?source=current")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets Sentry envelopes bypass canonical redirects", () => {
    const response = middleware(
      buildRequest("http://shed210.com/sentry-tunnel", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/x-sentry-envelope" },
      })
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("uses a catch-all matcher so excluded trailing paths reach middleware", () => {
    expect(config.matcher).toBe("/:path*");
  });

  it.each([
    [
      "https://www.shed210.com/home?source=legacy",
      "https://www.shed210.com/?source=legacy",
    ],
    [
      "http://shed210.com/home/?source=legacy",
      "https://www.shed210.com/?source=legacy",
    ],
  ])("redirects the legacy home URL %s to the canonical homepage", (requestUrl, expectedUrl) => {
    const response = middleware(buildRequest(requestUrl));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(expectedUrl);
  });

  it("does not redirect paths that only begin with home", () => {
    const response = middleware(
      buildRequest("https://www.shed210.com/homepage?source=current")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("preserves mutating request methods while canonicalizing the URL", () => {
    const response = middleware(
      buildRequest("http://shed210.com/api/quote", {
        method: "POST",
        body: JSON.stringify({ contact: "test" }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.shed210.com/api/quote"
    );
  });

  it("does not replace a Vercel preview host", () => {
    process.env.VERCEL_ENV = "preview";

    const response = middleware(
      buildRequest("https://shed210-git-seo-fixes-404dealer.vercel.app/gallery")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the preview host while redirecting a legacy gallery path", () => {
    process.env.VERCEL_ENV = "preview";

    const response = middleware(
      buildRequest(
        "https://shed210-git-seo-fixes-404dealer.vercel.app/our-work?city=schertz"
      )
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://shed210-git-seo-fixes-404dealer.vercel.app/gallery?city=schertz"
    );
  });

  it("leaves a local production server available for built-site QA", () => {
    delete process.env.VERCEL_ENV;

    const response = middleware(buildRequest("http://localhost:3000/gallery"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves the root path unchanged by trailing-slash normalization", () => {
    delete process.env.VERCEL_ENV;

    const response = middleware(
      buildRequest("http://localhost:3000/?source=root")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects the exact local legacy gallery path without forcing HTTPS", () => {
    delete process.env.VERCEL_ENV;

    const response = middleware(
      buildRequest("http://localhost:3000/our-work/?city=schertz")
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/gallery?city=schertz"
    );
  });

  it("leaves admin paths to normal app routing", () => {
    const response = middleware(
      buildRequest("https://www.shed210.com/admin/t/shed210/security?tab=audit")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
