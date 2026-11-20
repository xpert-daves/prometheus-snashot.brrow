import { render, screen } from "@testing-library/react";

import ContactPage, { revalidate } from "../page";
import { listResolvedServiceAreas } from "../../../lib/crmProjectCities.server";
import { FALLBACK_SERVICE_AREAS } from "../../../lib/serviceAreaRegistry";

jest.mock("../../../lib/crmProjectCities.server", () => ({
  listResolvedServiceAreas: jest.fn(),
}));

jest.mock("../../../components/ContactPageClient", () => ({
  __esModule: true,
  default: ({
    locations,
  }: {
    locations: Array<{ slug: string }>;
  }) => (
    <div data-testid="contact-map-locations">
      {locations.map((location) => location.slug).join(",")}
    </div>
  ),
}));

const mockListResolvedServiceAreas = jest.mocked(listResolvedServiceAreas);

describe("ContactPage", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.shed210.com";
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("keeps an hourly refresh fallback and passes resolved CRM towns to the map and points structured data at the business", async () => {
    expect(revalidate).toBe(3600);

    mockListResolvedServiceAreas.mockResolvedValue([
      ...FALLBACK_SERVICE_AREAS,
      {
        ...FALLBACK_SERVICE_AREAS[0],
        city: "Elmendorf",
        slug: "elmendorf",
        curated: false,
      },
    ]);

    const { container } = render(await ContactPage());

    expect(screen.getByTestId("contact-map-locations")).toHaveTextContent(
      "elmendorf"
    );
    const schema = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')
        ?.textContent ?? "{}"
    );
    // The business node lives on the homepage; the contact page points at it.
    expect(schema).toMatchObject({
      "@type": "ContactPage",
      url: "https://www.shed210.com/contact",
      mainEntity: {
        "@type": "HomeAndConstructionBusiness",
        "@id": "https://www.shed210.com/#localbusiness",
        name: "Shed210",
      },
    });
    expect(schema.mainEntity).not.toHaveProperty("areaServed");
  });
});
