import { render, screen, within } from "@testing-library/react";

import PortfolioSection from "@/components/PortfolioSection";
import type {
  PublicGalleryProject,
  PublicProjectPhoto,
} from "@/lib/crmProjects.server";

function buildPhoto(
  slug: string,
  photoNumber: number
): PublicProjectPhoto {
  return {
    url: `https://youthful-horse-290.convex.cloud/api/storage/${slug}-${photoNumber}`,
    alt: `${slug} exact photo ${photoNumber}`,
    filename: `${slug}-tx-${photoNumber}.jpg`,
  };
}

function buildProject({
  slug,
  dateInstalled,
  photoCount = 4,
  coverPhotoIndex = 0,
  city = "San Antonio",
  citySlug = "san-antonio",
}: {
  slug: string;
  dateInstalled: number;
  photoCount?: number;
  coverPhotoIndex?: number;
  city?: string;
  citySlug?: string;
}): PublicGalleryProject {
  const photos = Array.from({ length: photoCount }, (_, index) =>
    buildPhoto(slug, index + 1)
  );
  return {
    slug,
    city,
    citySlug,
    model: "Garden Shed",
    size: "10x12",
    dateInstalled,
    coverPhoto: photos[coverPhotoIndex],
    dedicatedPageEligible: false,
    photos,
    coverPhotoIndex,
  };
}

function buildProjectSet(count: number): PublicGalleryProject[] {
  return Array.from({ length: count }, (_, index) =>
    buildProject({
      slug: `project-${index + 1}`,
      city: `Build Area ${index + 1}`,
      citySlug: `build-area-${index + 1}`,
      dateInstalled: Date.UTC(2026, 0, index + 1),
      coverPhotoIndex: index % 4,
    })
  );
}

function newestProjects(
  projects: readonly PublicGalleryProject[],
  limit = 6
): PublicGalleryProject[] {
  return [...projects]
    .sort((left, right) => right.dateInstalled - left.dateInstalled)
    .slice(0, limit);
}

describe("PortfolioSection", () => {
  it("preserves the three-angle bento for the only published project", () => {
    const project = buildProject({
      slug: "only-project-lakehills",
      city: "Lakehills",
      citySlug: "lakehills",
      dateInstalled: Date.UTC(2026, 6, 24),
      coverPhotoIndex: 2,
    });
    const { container } = render(<PortfolioSection projects={[project]} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(
      images.map((image) => image.getAttribute("data-filename"))
    ).toEqual([
      "only-project-lakehills-tx-3.jpg",
      "only-project-lakehills-tx-1.jpg",
      "only-project-lakehills-tx-2.jpg",
    ]);
    expect(images[1]).toHaveAttribute(
      "sizes",
      "(max-width: 1023px) calc(100vw - 32px), (max-width: 1199px) 41vw, 470px"
    );
    expect(
      container.querySelector(".lg\\:grid-cols-\\[1\\.45fr_1fr\\]")
    ).not.toBeNull();
    expect(
      screen.getByText("One published build · 3 angles")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /as more projects go live, this space automatically shifts/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Recent Shed210 builds" })
    ).not.toBeInTheDocument();

    const projectHref = "/projects/lakehills/only-project-lakehills";
    const projectLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === projectHref);
    expect(projectLinks).toHaveLength(3);
    expect(
      projectLinks.map((link) => link.getAttribute("aria-label"))
    ).toEqual([
      expect.stringContaining("only-project-lakehills exact photo 3"),
      expect.stringContaining("only-project-lakehills exact photo 1"),
      expect.stringContaining("only-project-lakehills exact photo 2"),
    ]);
  });

  it("keeps repeated records for one project in the single-project bento", () => {
    const olderRecord = buildProject({
      slug: "same-project",
      dateInstalled: Date.UTC(2026, 5, 1),
      coverPhotoIndex: 0,
    });
    const latestRecord = buildProject({
      slug: "same-project",
      dateInstalled: Date.UTC(2026, 6, 1),
      coverPhotoIndex: 2,
    });

    render(<PortfolioSection projects={[olderRecord, latestRecord]} />);

    expect(
      screen.queryByRole("list", { name: "Recent Shed210 builds" })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("img").map((image) => image.dataset.filename)
    ).toEqual([
      "same-project-tx-3.jpg",
      "same-project-tx-1.jpg",
      "same-project-tx-2.jpg",
    ]);
    expect(
      screen.getByText("One published build · 3 angles")
    ).toBeInTheDocument();
  });

  it.each([
    {
      inputCount: 2,
      cardCount: 2,
      tag: "2 Recent Builds",
      desktopClass: "lg:grid-cols-2",
    },
    {
      inputCount: 3,
      cardCount: 3,
      tag: "3 Recent Builds",
      desktopClass: "lg:grid-cols-3",
    },
    {
      inputCount: 4,
      cardCount: 4,
      tag: "4 Recent Builds",
      desktopClass: "lg:grid-cols-2",
    },
    {
      inputCount: 5,
      cardCount: 5,
      tag: "5 Recent Builds",
      desktopClass: "lg:grid-cols-6",
    },
    {
      inputCount: 6,
      cardCount: 6,
      tag: "6 Recent Builds",
      desktopClass: "lg:grid-cols-3",
    },
    {
      inputCount: 7,
      cardCount: 6,
      tag: "Latest 6 Builds",
      desktopClass: "lg:grid-cols-3",
    },
  ])(
    "renders $inputCount projects as $cardCount equal semantic cards",
    ({ inputCount, cardCount, tag, desktopClass }) => {
      render(<PortfolioSection projects={buildProjectSet(inputCount)} />);

      const projectList = screen.getByRole("list", {
        name: "Recent Shed210 builds",
      });
      const cards = within(projectList).getAllByRole("listitem");
      const images = within(projectList).getAllByRole("img");

      expect(cards).toHaveLength(cardCount);
      expect(images).toHaveLength(cardCount);
      expect(projectList).toHaveClass(
        "grid-cols-1",
        "md:grid-cols-2",
        desktopClass
      );
      expect(screen.getByText(tag)).toBeInTheDocument();
      expect(
        screen.getByText(
          "Explore our newest builds across the area. Each project opens to every photo and detail."
        )
      ).toBeInTheDocument();
      expect(
        within(projectList).getAllByText("View project photos")
      ).toHaveLength(cardCount);

      images.forEach((image) => {
        expect(image.parentElement).toHaveClass("aspect-[4/3]");
      });
    }
  );

  it("uses only the exact cover, link, title, city, and month for each selected project", () => {
    const projects = buildProjectSet(3);
    const selectedProjects = newestProjects(projects);

    render(<PortfolioSection projects={projects} />);

    const projectList = screen.getByRole("list", {
      name: "Recent Shed210 builds",
    });
    const cards = within(projectList).getAllByRole("listitem");

    selectedProjects.forEach((project, index) => {
      const cover = project.photos[project.coverPhotoIndex];
      const link = within(cards[index]).getByRole("link");
      const image = within(link).getByRole("img");

      expect(link).toHaveAttribute(
        "href",
        `/projects/${project.citySlug}/${project.slug}`
      );
      expect(link).toHaveAccessibleName(
        `View project photos for 10x12 Garden Shed in ${project.city}`
      );
      expect(image.getAttribute("src")).toContain(
        encodeURIComponent(cover.url)
      );
      expect(image).toHaveAttribute("alt", cover.alt);
      expect(image).toHaveAttribute("data-filename", cover.filename);
      expect(image).toHaveAttribute(
        "sizes",
        "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 52px) / 2), (max-width: 1199px) calc((100vw - 80px) / 3), 374px"
      );
      expect(
        within(link).getByRole("heading", { level: 3 })
      ).toHaveTextContent("10x12 Garden Shed");
      expect(link).toHaveTextContent(project.city);
      expect(link).toHaveTextContent("January 2026");
    });

    expect(
      within(projectList)
        .getAllByRole("img")
        .map((image) => image.getAttribute("data-filename"))
    ).toEqual(selectedProjects.map((project) => project.coverPhoto.filename));
  });

  it("uses accurate two-column image sizes for the two- and four-card layouts", () => {
    const { rerender } = render(
      <PortfolioSection projects={buildProjectSet(2)} />
    );

    const expectedSizes =
      "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 52px) / 2), (max-width: 1199px) calc((100vw - 56px) / 2), 572px";
    expect(
      screen
        .getByRole("list", { name: "Recent Shed210 builds" })
        .querySelectorAll("img")
    ).toHaveLength(2);
    screen
      .getAllByRole("img")
      .forEach((image) => expect(image).toHaveAttribute("sizes", expectedSizes));

    rerender(<PortfolioSection projects={buildProjectSet(4)} />);

    screen
      .getAllByRole("img")
      .forEach((image) => expect(image).toHaveAttribute("sizes", expectedSizes));
  });

  it("centers the second row of the five-card desktop layout", () => {
    render(<PortfolioSection projects={buildProjectSet(5)} />);

    const cards = within(
      screen.getByRole("list", { name: "Recent Shed210 builds" })
    ).getAllByRole("listitem");

    expect(cards).toHaveLength(5);
    cards.forEach((card) => expect(card).toHaveClass("lg:col-span-2"));
    expect(cards[3]).toHaveClass("lg:col-start-2");
    expect(cards[4]).toHaveClass("lg:col-start-4");
  });

  it("caps the section at six newest covers without leaking secondary photos", () => {
    const projects = buildProjectSet(8);
    const expectedProjects = newestProjects(projects);

    render(<PortfolioSection projects={projects} />);

    const projectList = screen.getByRole("list", {
      name: "Recent Shed210 builds",
    });
    const images = within(projectList).getAllByRole("img");
    const links = within(projectList).getAllByRole("link");

    expect(images).toHaveLength(6);
    expect(
      images.map((image) => image.getAttribute("data-filename"))
    ).toEqual(
      expectedProjects.map((project) => project.coverPhoto.filename)
    );
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expectedProjects.map(
        (project) => `/projects/${project.citySlug}/${project.slug}`
      )
    );
    expect(
      images.some((image) =>
        image
          .getAttribute("data-filename")
          ?.startsWith(`${projects[0].slug}-`)
      )
    ).toBe(false);
    expect(screen.getByText("Latest 6 Builds")).toBeInTheDocument();
  });

  it("retains the approved static portfolio only when no CRM project exists", () => {
    render(<PortfolioSection projects={[]} />);

    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getByText("Real Local Projects")
    ).toBeInTheDocument();
    expect(screen.getByText("Built on your property")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /view the project gallery/i })
    ).toHaveLength(3);
    expect(
      screen.queryByRole("list", { name: "Recent Shed210 builds" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /exact photo/i })
    ).not.toBeInTheDocument();
  });
});
