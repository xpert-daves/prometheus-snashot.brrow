/** @jest-environment node */
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { POST } from "../route";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const mockRevalidatePath = jest.mocked(revalidatePath);
const secret = "test-only-revalidation-secret-32-characters";
const projectEvent = {
  version: 1,
  tenantSlug: "shed210",
  kind: "projects",
  projectPaths: ["/projects/san-antonio/old-shed", "/projects/luling/new-shed"],
};

function request(body: unknown = projectEvent, headers: Record<string, string> = {}) {
  return new NextRequest("https://www.shed210.com/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("CRM publication revalidation", () => {
  const originalSecret = process.env.SHED210_SITE_REVALIDATION_SECRET;
  beforeEach(() => {
    process.env.SHED210_SITE_REVALIDATION_SECRET = secret;
    mockRevalidatePath.mockReset();
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SHED210_SITE_REVALIDATION_SECRET;
    else process.env.SHED210_SITE_REVALIDATION_SECRET = originalSecret;
  });

  it.each([undefined, "short"])("fails closed for missing/weak configuration (%s)", async (value) => {
    if (value === undefined) delete process.env.SHED210_SITE_REVALIDATION_SECRET;
    else process.env.SHED210_SITE_REVALIDATION_SECRET = value;
    expect((await POST(request())).status).toBe(503);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it.each(["", "Bearer incorrect", `Basic ${secret}`, `Bearer ${secret} extra`])(
    "rejects invalid authorization without invalidating content", async (authorization) => {
      expect((await POST(request(projectEvent, { authorization }))).status).toBe(401);
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    },
  );

  it("invalidates public listings plus both old and new project URLs", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockRevalidatePath.mock.calls).toEqual([
      ["/"], ["/buildings"], ["/gallery"], ["/service-area"], ["/sitemap.xml"],
      ["/service-area/[city]", "page"],
      ["/projects/san-antonio/old-shed"], ["/projects/luling/new-shed"],
    ]);
  });

  it("deduplicates project paths", async () => {
    await POST(request({ ...projectEvent, projectPaths: [projectEvent.projectPaths[0], projectEvent.projectPaths[0]] }));
    expect(mockRevalidatePath.mock.calls.filter(([path]) => path === projectEvent.projectPaths[0])).toHaveLength(1);
  });

  it("refreshes project metadata and contact locations when the city registry changes", async () => {
    expect((await POST(request({ version: 1, tenantSlug: "shed210", kind: "cities" }))).status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/contact");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/[citySlug]/[slug]", "page");
    expect(mockRevalidatePath).not.toHaveBeenCalledWith("/", "layout");
  });

  it.each([
    { ...projectEvent, tenantSlug: "other-tenant" },
    { ...projectEvent, version: 2 },
    { ...projectEvent, projectPaths: [] },
    { ...projectEvent, projectPaths: Array(51).fill("/projects/luling/shed") },
    { ...projectEvent, paths: ["/admin"] },
    { version: 1, tenantSlug: "shed210", kind: "cities", projectPaths: ["/projects/luling/shed"] },
    ...["/admin", "/projects/../admin", "/projects/luling/shed?draft=1", "/projects/luling/%2fadmin", "https://elsewhere.test/projects/luling/shed", `/projects/${"x".repeat(81)}/shed`].map(
      (path) => ({ ...projectEvent, projectPaths: [path] }),
    ),
  ])("rejects events outside the allowed tenant and route contract", async (event) => {
    expect((await POST(request(event))).status).toBe(400);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed, non-JSON, and oversized bodies before invalidation", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(projectEvent, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request(" ".repeat(32_769)))).status).toBe(413);
    expect((await POST(request(projectEvent, { "content-length": "40000" }))).status).toBe(413);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("allows the sender to retry a partial invalidation failure", async () => {
    mockRevalidatePath.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    expect((await POST(request())).status).toBe(503);
    expect((await POST(request())).status).toBe(200);
  });
});
