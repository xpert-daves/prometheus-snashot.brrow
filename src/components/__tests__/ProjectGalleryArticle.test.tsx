import { render, screen, within } from "@testing-library/react";

import ProjectGalleryArticle from "@/components/ProjectGalleryArticle";
import type { PublicGalleryProject } from "@/lib/crmProjects.server";

function buildProject(): PublicGalleryProject {
  const photos = [
    {
      url: "https://youthful-horse-290.convex.cloud/api/storage/front",
      alt: "Front view of the Lakehills project",
      filename: "6x8x7-shed-lakehills-tx-1.jpg",
    },
    {
      url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
      alt: "Selected cover view of the Lakehills project",
      filename: "6x8x7-shed-lakehills-tx-2.jpg",
    },
    {
      url: "https://youthful-horse-290.convex.cloud/api/storage/interior",
      alt: "Interior view of the Lakehills project",
      filename: "6x8x7-shed-lakehills-tx-3.jpg",
    },
  ];
  return {
    slug: "6x8x7-shed-lakehills",
    city: "Lakehills",
    citySlug: "lakehills",
    title: "Shed",
    model: "Storage & Utility",
    size: "6x8x7",
    dateInstalled: Date.UTC(2026, 6, 19),
    coverPhoto: photos[1],
    dedicatedPageEligible: false,
    photos,
    coverPhotoIndex: 1,
  };
}

describe("ProjectGalleryArticle", () => {
  it("groups every photo exactly once under one project and links to its detail page", () => {
    const project = buildProject();
    const { container } = render(
      <ProjectGalleryArticle project={project} priority />
    );
    const article = container.querySelector(
      "#project-6x8x7-shed-lakehills"
    );

    expect(article).not.toBeNull();
    const images = within(article as HTMLElement).getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(
      images.map((image) => image.getAttribute("data-filename"))
    ).toEqual([
      "6x8x7-shed-lakehills-tx-2.jpg",
      "6x8x7-shed-lakehills-tx-1.jpg",
      "6x8x7-shed-lakehills-tx-3.jpg",
    ]);
    expect(new Set(images.map((image) => image.getAttribute("src"))).size).toBe(
      3
    );

    const projectHref = "/projects/lakehills/6x8x7-shed-lakehills";
    expect(
      within(article as HTMLElement).getByRole("heading", {
        name: "6x8x7 Shed",
      })
    ).toBeInTheDocument();
    expect(
      within(article as HTMLElement).getByText("3 photos")
    ).toBeInTheDocument();
    expect(
      within(article as HTMLElement).getAllByRole("link", {
        name: /view project details:/i,
      })
    ).toHaveLength(3);
    expect(
      within(article as HTMLElement).getByRole("link", {
        name: "View project details",
      })
    ).toHaveAttribute("href", projectHref);
    for (const link of within(article as HTMLElement).getAllByRole("link")) {
      if (link.textContent?.includes("Lakehills, TX")) continue;
      expect(link).toHaveAttribute("href", projectHref);
    }
    expect(screen.queryByText("Shown in this gallery")).not.toBeInTheDocument();
  });
});
