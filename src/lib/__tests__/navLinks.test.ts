import { NAV_LINKS, isNavLinkActive } from "@/lib/navLinks";

describe("primary navigation", () => {
  it("expresses the approved buyer hierarchy without Home or Quote peers", () => {
    expect(NAV_LINKS).toEqual([
      { href: "/buildings", label: "Buildings" },
      { href: "/gallery", label: "Gallery" },
      { href: "/service-area", label: "Service Areas" },
      { href: "/news", label: "Guides" },
      { href: "/contact", label: "Contact" },
    ]);
    expect(NAV_LINKS.some((link) => link.href === "/")).toBe(false);
    expect(NAV_LINKS.some((link) => link.href === "/quote")).toBe(false);
  });

  it.each([
    ["/buildings", "/buildings"],
    ["/gallery", "/gallery"],
    ["/projects/boerne/10x12-greenhouse-boerne", "/gallery"],
    ["/service-area", "/service-area"],
    ["/service-area/san-antonio", "/service-area"],
    ["/news", "/news"],
    ["/news/san-antonio-shed-cost-guide", "/news"],
    ["/contact", "/contact"],
  ])("maps %s to the %s primary destination", (pathname, activeHref) => {
    const activeLinks = NAV_LINKS.filter((link) =>
      isNavLinkActive(pathname, link.href)
    );
    expect(activeLinks.map((link) => link.href)).toEqual([activeHref]);
  });

  it.each(["/", "/quote", "/privacy-policy", null])(
    "leaves %s without a falsely active primary destination",
    (pathname) => {
      expect(
        NAV_LINKS.filter((link) => isNavLinkActive(pathname, link.href))
      ).toHaveLength(0);
    }
  );
});
