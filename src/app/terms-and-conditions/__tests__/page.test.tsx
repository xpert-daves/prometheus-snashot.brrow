import { render, screen } from "@testing-library/react";
import TermsAndConditionsPage from "../page";

describe("TermsAndConditionsPage", () => {
  it("distinguishes required online quote texts from promotional consent", () => {
    render(<TermsAndConditionsPage />);

    expect(
      screen.getByRole("heading", { name: "8. SMS Terms & Messaging Policy" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/To use the online quote tool, you must agree to receive text messages/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/does not include marketing or promotional texts/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not required to purchase goods or services/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Reply STOP to opt out or HELP for help/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy-policy"
    );
  });

  it("links Google review content to the applicable Google terms", () => {
    render(<TermsAndConditionsPage />);

    expect(
      screen.getByRole("heading", { name: "10. Third-Party Services" })
    ).toBeInTheDocument();
    expect(screen.getByText(/ratings, and reviews provided through Google Maps/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google Terms of Service" })).toHaveAttribute(
      "href",
      "https://policies.google.com/terms"
    );
    expect(
      screen.getByRole("link", { name: "Google Maps Additional Terms of Service" })
    ).toHaveAttribute("href", "https://maps.google.com/help/terms_maps/");
  });
});
