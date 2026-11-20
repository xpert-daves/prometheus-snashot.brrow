import { render, screen } from "@testing-library/react";
import AccessibilityPage, { metadata } from "../page";

describe("AccessibilityPage", () => {
  it("states the accessibility target and provides equivalent contact options", () => {
    render(<AccessibilityPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Accessibility" })
    ).toBeInTheDocument();
    expect(screen.getByText(/WCAG\) 2\.2 Level AA/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "info@shed210.com" })
    ).toHaveAttribute("href", "mailto:info@shed210.com");
    expect(
      screen.getByRole("link", { name: "(855) 578-0944" })
    ).toHaveAttribute("href", "sms:+18555780944");
    expect(screen.getByRole("link", { name: "contact page" })).toHaveAttribute(
      "href",
      "/contact"
    );
  });

  it("publishes canonical accessibility metadata", () => {
    expect(metadata).toMatchObject({
      title: "Accessibility",
      alternates: { canonical: "/accessibility" },
    });
  });
});
