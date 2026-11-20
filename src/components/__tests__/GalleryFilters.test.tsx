import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GalleryFilters from "@/components/GalleryFilters";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

const cities = [
  { city: "San Antonio", slug: "san-antonio", count: 0 },
  { city: "Schertz", slug: "schertz", count: 1 },
] as const;
const projectTypes = [
  { projectType: "Storage & Utility", count: 0 },
  { projectType: "Greenhouse", count: 1 },
] as const;

describe("GalleryFilters", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("submits selected city and project type as linkable GET parameters", () => {
    const { container } = render(
      <GalleryFilters
        cities={cities}
        projectTypes={projectTypes}
        selectedCity="schertz"
        selectedProjectType="Greenhouse"
      />
    );

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/gallery");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue(
      "schertz"
    );
    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      "Greenhouse"
    );
    expect(
      screen.getByRole("combobox", { name: "Project type" })
    ).toHaveAttribute("name", "type");
    expect(
      screen.getByRole("option", { name: "Schertz (1)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Greenhouse (1)" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /apply filters/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute(
      "href",
      "/gallery"
    );
  });

  it("falls back to all options for unknown values without leaving a false active state", () => {
    render(
      <GalleryFilters
        cities={cities}
        projectTypes={projectTypes}
        selectedCity="austin"
        selectedProjectType="Unknown type"
      />
    );

    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      ""
    );
    expect(
      screen.queryByRole("link", { name: "Clear" })
    ).not.toBeInTheDocument();
  });

  it("selects the canonical project type for a case-insensitive query value", () => {
    render(
      <GalleryFilters
        cities={cities}
        projectTypes={projectTypes}
        selectedProjectType="storage & utility"
      />
    );

    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      "Storage & Utility"
    );
  });

  it("does not show clear when no filter is active", () => {
    render(<GalleryFilters cities={cities} projectTypes={projectTypes} />);
    expect(screen.queryByRole("link", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("writes the controlled project type to the new type query parameter", async () => {
    const user = userEvent.setup();
    render(<GalleryFilters cities={cities} projectTypes={projectTypes} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Project type" }),
      "Greenhouse"
    );

    expect(mockReplace).toHaveBeenCalledWith("/gallery?type=Greenhouse", {
      scroll: false,
    });
  });

  it("applies changes instantly and clears an incompatible project type when the city changes", async () => {
    const user = userEvent.setup();
    render(
      <GalleryFilters
        cities={cities}
        projectTypes={projectTypes}
        selectedCity="schertz"
        selectedProjectType="Greenhouse"
      />
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "City" }),
      "san-antonio"
    );

    expect(mockReplace).toHaveBeenCalledWith("/gallery?city=san-antonio", {
      scroll: false,
    });
    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      ""
    );
  });
});
