import { render, screen, fireEvent, within } from "@testing-library/react";
import Navbar from "../Navbar";
import MobileMenu from "../NavbarMobileMenu";
import { PHONE_NUMBER } from "@/lib/contact";
import { trackEvent } from "../../lib/analytics";
import { usePathname } from "next/navigation";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("../../lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

const mockUsePathname = usePathname as jest.Mock;

describe("Navbar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    (trackEvent as jest.Mock).mockClear();
  });

  it("uses the approved desktop hierarchy and one primary price action", () => {
    render(<Navbar />);

    const desktopNav = screen.getByRole("navigation", { name: /primary/i });
    const homeLink = screen.getByRole("link", { name: /shed210 home/i });
    const logo = within(homeLink).getByAltText("Shed210");
    const quoteLinks = screen.getAllByRole("link", { name: "Get Instant Price" });
    const textLinks = screen.getAllByRole("link", {
      name: /text \(855\) 578-0944/i,
    });

    expect(decodeURIComponent(logo.getAttribute("src") ?? "")).toContain(
      "/logos/nav-logo-shed210-horizontal-transparent.png"
    );
    expect(within(desktopNav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Buildings",
      "Gallery",
      "Service Areas",
      "Guides",
      "Contact",
    ]);
    expect(within(desktopNav).queryByRole("link", { name: "Home" })).toBeNull();
    expect(
      within(desktopNav).queryByRole("link", { name: /instant price/i })
    ).toBeNull();
    expect(quoteLinks).toHaveLength(2);
    expect(quoteLinks.every((link) => link.getAttribute("href") === "/quote")).toBe(
      true
    );
    expect(textLinks).toHaveLength(1);
    expect(textLinks.map((link) => link.getAttribute("href"))).toEqual([
      `sms:${PHONE_NUMBER}`,
    ]);
    const callLink = screen.getByRole("link", { name: /call \(855\) 578-0944/i });
    expect(callLink).toHaveAttribute("href", `tel:${PHONE_NUMBER}`);
    fireEvent.click(callLink);
    expect(trackEvent).toHaveBeenCalledWith("phone_click", { location: "site_header" });
    expect(screen.queryByRole("link", { name: /facebook/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /google/i })).toBeNull();
  });

  it("keeps pricing available in the mobile header and separate Call and Text actions in the menu", () => {
    render(<MobileMenu />);

    const collapsedPriceLink = screen.getByRole("link", {
      name: "Get Instant Price",
    });
    expect(collapsedPriceLink).toHaveAttribute("href", "/quote");
    expect(collapsedPriceLink).toHaveClass("lg:hidden");
    expect(
      screen.queryByRole("link", { name: /text \(855\) 578-0944/i })
    ).toBeNull();

    fireEvent.click(collapsedPriceLink);
    expect(trackEvent).toHaveBeenCalledWith("quote_cta_clicked", {
      location: "mobile_header",
    });
    (trackEvent as jest.Mock).mockClear();

    fireEvent.click(screen.getByRole("button", { name: /open mobile menu/i }));

    const openMobileNav = screen.getByRole("navigation", {
      name: /mobile navigation/i,
    });
    expect(
      within(openMobileNav).getByRole("link", {
        name: /text \(855\) 578-0944/i,
      })
    ).toHaveAttribute("href", `sms:${PHONE_NUMBER}`);
    expect(
      within(openMobileNav).getByRole("link", { name: /call \(855\) 578-0944/i })
    ).toHaveAttribute("href", `tel:${PHONE_NUMBER}`);

    fireEvent.click(
      within(openMobileNav).getByRole("link", { name: "Get Instant Price" })
    );
    expect(trackEvent).toHaveBeenCalledWith("quote_cta_clicked", {
      location: "mobile_menu",
    });
  });

  it("opens the same hierarchy on mobile with pricing primary and Text secondary", () => {
    const { container } = render(<Navbar />);
    const toggle = screen.getByRole("button", { name: /open mobile menu/i });
    const mobileNav = container.querySelector("#mobile-nav");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "mobile-nav");
    expect(mobileNav).toHaveAttribute("hidden");
    expect(mobileNav).toHaveAttribute("data-state", "closed");
    expect(
      screen.queryByRole("navigation", { name: /mobile navigation/i })
    ).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(/close mobile menu/i);
    expect(mobileNav).toHaveAttribute("data-state", "open");
    expect(mobileNav).not.toHaveAttribute("hidden");

    const openMobileNav = screen.getByRole("navigation", {
      name: /mobile navigation/i,
    });
    expect(within(openMobileNav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Buildings",
      "Gallery",
      "Service Areas",
      "Guides",
      "Contact",
      "Get Instant Price",
      "Call",
      "Text",
    ]);
    expect(within(openMobileNav).queryByRole("link", { name: "Home" })).toBeNull();
    expect(
      within(openMobileNav).getByRole("link", { name: "Get Instant Price" })
    ).toHaveAttribute("href", "/quote");
  });

  it("marks Gallery active for project pages in both navigation copies", () => {
    mockUsePathname.mockReturnValue(
      "/projects/boerne/10x12-greenhouse-boerne"
    );
    render(<Navbar />);

    const desktopNav = screen.getByRole("navigation", { name: /primary/i });
    expect(within(desktopNav).getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(desktopNav).getAllByRole("link").filter((link) =>
      link.hasAttribute("aria-current")
    )).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /open mobile menu/i }));
    const mobileNav = screen.getByRole("navigation", {
      name: /mobile navigation/i,
    });
    expect(within(mobileNav).getByRole("link", { name: "Gallery" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(mobileNav).getAllByRole("link").filter((link) =>
      link.hasAttribute("aria-current")
    )).toHaveLength(1);
  });

  it("closes with Escape, removes the links from navigation, and restores focus", () => {
    const { container } = render(<Navbar />);
    const toggle = screen.getByRole("button", { name: /open mobile menu/i });

    fireEvent.click(toggle);
    const mobileNav = screen.getByRole("navigation", {
      name: /mobile navigation/i,
    });
    const firstLink = within(mobileNav).getByRole("link", { name: "Buildings" });
    firstLink.focus();
    expect(firstLink).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("#mobile-nav")).toHaveAttribute("hidden");
    expect(
      screen.queryByRole("navigation", { name: /mobile navigation/i })
    ).toBeNull();
  });
});
