import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import RecentInstalls, {
  RECENT_INSTALL_LIMIT,
} from "@/components/RecentInstalls";

function buildProject(index: number): PublicProjectSummary {
  return {
    slug: `10x${index + 10}-garden-shed-san-antonio`,
    city: "San Antonio",
    citySlug: "san-antonio",
    model: "Garden Shed",
    size: `10x${index + 10}`,
    dateInstalled: Date.UTC(2026, 6, 10 - index),
    coverPhoto: {
      url: `https://youthful-horse-290.convex.cloud/api/storage/photo-${index}`,
      alt: `Exact CRM alt ${index}`,
      filename: `10x${index + 10}-garden-shed-san-antonio-tx-1.jpg`,
    },
    dedicatedPageEligible: index % 2 === 0,
    ...(index === 1 ? {} : { price: index * 100_00 }),
  };
}

describe("RecentInstalls", () => {
  it("renders project content and structured image metadata in server HTML", () => {
    const projects = [buildProject(0), buildProject(1)];
    const html = renderToStaticMarkup(
      <RecentInstalls
        city="San Antonio"
        citySlug="san-antonio"
        projects={projects}
      />
    );

    expect(html).toContain("Recent builds in San Antonio");
    expect(html).toContain("Exact CRM alt 0");
    expect(html).toContain(
      'data-filename="10x10-garden-shed-san-antonio-tx-1.jpg"'
    );
    expect(html).toContain(
      "/projects/san-antonio/10x10-garden-shed-san-antonio"
    );
    expect(html).toContain(
      "/projects/san-antonio/10x11-garden-shed-san-antonio"
    );
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).toContain(
      '"contentUrl":"https://youthful-horse-290.convex.cloud/api/storage/photo-0"'
    );
    expect(html).toContain('"caption":"Exact CRM alt 0"');
    expect(html).toContain(
      '"name":"10x10-garden-shed-san-antonio-tx-1.jpg"'
    );
  });

  it("cannot close CRM-derived JSON-LD with malicious admin text", () => {
    const malicious =
      '</script><script data-xss="true">window.compromised=true</script>';
    const project = {
      ...buildProject(0),
      model: malicious,
      coverPhoto: {
        ...buildProject(0).coverPhoto,
        alt: malicious,
      },
    };
    const html = renderToStaticMarkup(
      <RecentInstalls
        city="San Antonio"
        citySlug="san-antonio"
        projects={[project]}
      />
    );
    const jsonLdMatch = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    );

    expect(jsonLdMatch).not.toBeNull();
    expect(html).not.toContain(
      '<script data-xss="true">window.compromised=true</script>'
    );
    expect(jsonLdMatch?.[1]).toContain(
      '\\u003c/script\\u003e\\u003cscript data-xss=\\"true\\"\\u003e'
    );
    expect(
      (html.match(/<script(?:\s|>)/g) ?? []).length
    ).toBe(1);
    expect(
      JSON.parse(jsonLdMatch?.[1] ?? "{}").itemListElement[0].item.caption
    ).toBe(malicious);
  });

  it("shows at most six newest projects and a city-filtered more link", () => {
    const projects = Array.from(
      { length: RECENT_INSTALL_LIMIT + 1 },
      (_, index) => buildProject(index)
    );
    render(
      <RecentInstalls
        city="San Antonio"
        citySlug="san-antonio"
        projects={projects}
      />
    );

    expect(screen.getAllByRole("img")).toHaveLength(RECENT_INSTALL_LIMIT);
    expect(screen.queryByAltText("Exact CRM alt 6")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view all san antonio builds/i })
    ).toHaveAttribute("href", "/gallery?city=san-antonio");
  });

  it("does not render a section or more link for zero or six projects", () => {
    const { rerender } = render(
      <RecentInstalls
        city="San Antonio"
        citySlug="san-antonio"
        projects={[]}
      />
    );
    expect(
      screen.queryByRole("heading", { name: /recent builds/i })
    ).not.toBeInTheDocument();

    rerender(
      <RecentInstalls
        city="San Antonio"
        citySlug="san-antonio"
        projects={Array.from(
          { length: RECENT_INSTALL_LIMIT },
          (_, index) => buildProject(index)
        )}
      />
    );
    expect(
      screen.queryByRole("link", { name: /view all/i })
    ).not.toBeInTheDocument();
  });
});
