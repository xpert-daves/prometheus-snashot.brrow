import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GalleryGrid from "../GalleryGrid";
import type { PortfolioProject } from "@/lib/portfolio";

const items: readonly PortfolioProject[] = [
  {
    src: "/portfolio/IMG_6287.jpeg",
    alt: "Gray gable shed with a white door",
    caption: "Gray backyard shed",
    city: "San Antonio",
    projectType: "Storage shed",
    size: "10x12",
    useCase: "Backyard storage",
    features: ["Gable roof"],
  },
  {
    src: "/portfolio/IMG_6288.jpeg",
    alt: "Tan shed beneath mature trees",
    caption: "Tan garden shed",
    city: "Schertz",
    projectType: "Garden shed",
    size: "8x10",
    useCase: "Garden tools",
    features: ["Double door"],
  },
];

describe("GalleryGrid lightbox", () => {
  it("contains keyboard focus, supports arrow keys, and restores the opener", async () => {
    const user = userEvent.setup();
    render(<GalleryGrid items={items} />);

    const opener = screen.getByRole("button", {
      name: /open gray backyard shed/i,
    });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", {
      name: "Gray backyard shed",
    });
    const closeButton = within(dialog).getByRole("button", {
      name: /close photo viewer/i,
    });
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(dialog).toHaveAccessibleDescription(/photo 1 of 2/i);
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(
      within(dialog).getByRole("button", { name: /next photo/i })
    ).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("dialog", { name: "Tan garden shed" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
