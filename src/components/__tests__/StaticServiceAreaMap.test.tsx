import { render, screen } from "@testing-library/react";
import StaticServiceAreaMap, {
  MAP_LOCATIONS,
} from "../StaticServiceAreaMap";
import { SERVICE_AREAS } from "@/lib/serviceAreas";

describe("StaticServiceAreaMap", () => {
  it("describes the included service area without implying shed delivery", () => {
    render(<StaticServiceAreaMap showCityLinks />);

    expect(screen.getByText("No distance fee")).toBeInTheDocument();
    expect(screen.getByText("Within 35 miles")).toBeInTheDocument();
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /35-mile Shed210 service area/i,
      })
    ).toBeInTheDocument();
  });

  it("keeps every mapped city and service-area link in canonical order", () => {
    expect(MAP_LOCATIONS.map(({ city, slug }) => ({ city, slug }))).toEqual(
      SERVICE_AREAS.map(({ city, slug }) => ({ city, slug }))
    );

    const { container } = render(<StaticServiceAreaMap showCityLinks />);
    const cityLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>(
        'a[href^="/service-area/"]:not([data-map-pin])'
      )
    );

    expect(cityLinks.map((link) => link.getAttribute("href"))).toEqual(
      SERVICE_AREAS.map(({ slug }) => `/service-area/${slug}`)
    );
  });

  it("makes every pin tap through to its city without adding tab stops", () => {
    const { container } = render(<StaticServiceAreaMap showCityLinks />);
    const pins = Array.from(
      container.querySelectorAll<SVGAElement>("a[data-map-pin]")
    );

    expect(pins.map((pin) => pin.getAttribute("href"))).toEqual(
      SERVICE_AREAS.map(({ slug }) => `/service-area/${slug}`)
    );
    expect(pins.every((pin) => pin.getAttribute("tabindex") === "-1")).toBe(true);
  });

  it("renders supplied towns and zooms out to fit distant coordinates", () => {
    const locations = [
      MAP_LOCATIONS[0],
      {
        city: "Alpine",
        slug: "alpine",
        lat: 30.3585,
        lon: -103.661,
        sourceLabel: "OpenStreetMap contributors",
      },
    ];
    const { container } = render(
      <StaticServiceAreaMap locations={locations} showCityLinks />
    );

    expect(screen.getByRole("link", { name: /Alpine/ })).toHaveAttribute(
      "href",
      "/service-area/alpine"
    );
    const tileHrefs = Array.from(
      container.querySelectorAll<SVGImageElement>("svg image")
    ).map((tile) => tile.getAttribute("href") ?? "");
    expect(tileHrefs.length).toBeGreaterThan(0);
    expect(tileHrefs.every((href) => !href.includes("/8/"))).toBe(true);
  });
});
