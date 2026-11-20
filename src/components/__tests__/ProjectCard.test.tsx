import { fireEvent, render, screen } from "@testing-library/react";
import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import ProjectCard from "@/components/ProjectCard";

function buildProject(
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary {
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Garden Shed",
    model: "Storage & Utility",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 1),
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/master-cover-original",
      thumbnailUrl:
        "https://youthful-horse-290.convex.cloud/api/storage/cover-thumbnail.webp",
      galleryUrl:
        "https://youthful-horse-290.convex.cloud/api/storage/cover-gallery.webp",
      socialPreviewUrl:
        "https://youthful-horse-290.convex.cloud/api/storage/cover-social.jpg",
      width: 1920,
      height: 1440,
      alt: "Exact CRM project alt",
      filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
    },
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

describe("ProjectCard", () => {
  it("shares one optimized CRM thumbnail variant, retaining content, price, and links", () => {
    const project = buildProject();
    render(<ProjectCard project={project} />);

    const image = screen.getByRole("img", {
      name: project.coverPhoto.alt,
    });
    expect(image).toHaveAttribute(
      "data-filename",
      project.coverPhoto.filename
    );
    const imageUrl = new URL(image.getAttribute("src")!, "https://www.shed210.com");
    expect(imageUrl.pathname).toBe("/_next/image");
    expect(imageUrl.searchParams.get("url")).toBe(project.coverPhoto.thumbnailUrl);
    expect(imageUrl.searchParams.get("w")).toBe("828");
    expect(imageUrl.searchParams.get("q")).toBe("60");
    expect(image).not.toHaveAttribute("srcset");
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(
      "cover-thumbnail.webp"
    );
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).not.toContain(
      "master-cover-original"
    );

    const projectLinks = screen.getAllByRole("link", {
      name: /10x12 garden shed/i,
    });
    expect(
      projectLinks.some(
        (link) =>
          link.getAttribute("href") ===
          "/projects/san-antonio/10x12-garden-shed-san-antonio"
      )
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "San Antonio, TX" })
    ).toHaveAttribute("href", "/service-area/san-antonio");
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText("$4,500")).toBeInTheDocument();
    expect(screen.getByText("Recorded build price")).toBeInTheDocument();
    expect(screen.getByText("Request a current quote for your size and site."))
      .toBeInTheDocument();
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", project.coverPhoto.thumbnailUrl);
    expect(image).not.toHaveAttribute("srcset");
  });

  it("continues resizing legacy originals for responsive card display", () => {
    const photo = {
      url: "https://youthful-horse-290.convex.cloud/api/storage/original",
      alt: "Legacy original",
      filename: "legacy.jpg",
    };
    render(<ProjectCard project={buildProject({ coverPhoto: photo })} />);

    const image = screen.getByRole("img", { name: photo.alt });
    expect(image.getAttribute("src")).toMatch(/^\/_next\/image\?/);
    expect(image).toHaveAttribute("srcset");
    expect(image).toHaveAttribute("sizes");
  });

  it("uses the dedicated project page even for a legacy-ineligible project and omits a hidden price", () => {
    render(
      <ProjectCard
        project={buildProject({
          dedicatedPageEligible: false,
          price: undefined,
        })}
      />
    );

    expect(
      screen.getByRole("link", { name: /view project details/i })
    ).toHaveAttribute(
      "href",
      "/projects/san-antonio/10x12-garden-shed-san-antonio"
    );
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded build price")).not.toBeInTheDocument();
  });

  it("does not render the obsolete gallery-only status", () => {
    render(
      <ProjectCard
        project={buildProject({
          dedicatedPageEligible: false,
          price: undefined,
        })}
      />
    );

    expect(
      screen.queryByRole("link", { name: /find in the gallery/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Exact CRM project alt" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "10x12 Garden Shed" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Shown in this gallery")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "San Antonio, TX" })
    ).toHaveAttribute("href", "/service-area/san-antonio");
  });

  it("renders a visible zero price", () => {
    render(<ProjectCard project={buildProject({ price: 0 })} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
  });
});
