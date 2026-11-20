import { render, screen, within } from "@testing-library/react";
import Footer from "../Footer";

describe("Footer", () => {
  it("describes completed projects without implying shed delivery", () => {
    render(<Footer />);

    expect(screen.getByText(/Explore completed projects to compare sizes/i)).toBeInTheDocument();
    expect(screen.queryByText(/more than 500 projects completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/projects delivered/i)).not.toBeInTheDocument();
  });

  it("discloses Microsoft Clarity use and links to the privacy policy", () => {
    render(<Footer />);

    expect(
      screen.getByText(/We use Microsoft Clarity to understand how visitors use this site/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/clicks, scrolling, and session interactions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Shed210 and Microsoft can collect and use this data/i)
    ).toBeInTheDocument();

    const privacyLinks = screen.getAllByRole("link", { name: "Privacy Policy" });
    expect(privacyLinks.some((link) => link.getAttribute("href") === "/privacy-policy")).toBe(
      true
    );
  });

  it("links the Frontier Pixel credit to the case study in a new tab", () => {
    render(<Footer />);

    const creditLink = screen.getByRole("link", { name: /built by frontier pixel/i });
    expect(creditLink).toHaveAttribute("href", "https://www.frontierpixel.com/work/shed-210");
    expect(creditLink).toHaveAttribute("target", "_blank");
    expect(creditLink.getAttribute("rel")).toContain("noopener");
  });

  it("groups buyer routes without repeating every city page", () => {
    const { container } = render(<Footer />);

    const expectedGroups = [
      [
        "Plan Your Building footer links",
        [
          ["Buildings", "/buildings"],
          ["Get Instant Price", "/quote"],
          ["Contact", "/contact"],
        ],
      ],
      ["Real Work footer links", [["Gallery", "/gallery"]]],
      ["Service Areas footer links", [["All Service Areas", "/service-area"]]],
      [
        "Guides footer links",
        [
          ["All Guides", "/news"],
          ["Shed Cost Guide", "/news/san-antonio-shed-cost-guide"],
          ["Permits & HOA Guide", "/news/sanantonio_shed_guide"],
        ],
      ],
      [
        "Legal footer links",
        [
          ["Accessibility", "/accessibility"],
          ["Privacy Policy", "/privacy-policy"],
          ["Terms & Conditions", "/terms-and-conditions"],
          ["SMS Terms", "/terms-and-conditions#sms-terms"],
        ],
      ],
    ] as const;

    for (const [navLabel, links] of expectedGroups) {
      const nav = screen.getByRole("navigation", { name: navLabel });
      for (const [label, href] of links) {
        expect(within(nav).getByRole("link", { name: label })).toHaveAttribute(
          "href",
          href
        );
      }
    }

    expect(container.querySelectorAll('a[href^="/service-area/"]')).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
  });

  it("links to the accessibility feedback page", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Accessibility" })).toHaveAttribute(
      "href",
      "/accessibility"
    );
    expect(
      screen.getByRole("navigation", { name: "Social links" })
    ).toBeInTheDocument();
  });

  it("uses a shorter footer slogan on mobile without removing the full desktop copy", () => {
    render(<Footer />);

    expect(
      screen.getByText("Shed210 · San Antonio, TX", { selector: "span" })
    ).toHaveClass("sm:hidden");
    expect(
      screen.getByText(
        "Shed210 · San Antonio, TX · Built for Texas. Built to last.",
        { selector: "span" }
      )
    ).toHaveClass("hidden", "sm:inline");
  });
});
