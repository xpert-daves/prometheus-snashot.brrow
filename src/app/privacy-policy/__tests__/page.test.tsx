import { render, screen } from "@testing-library/react";
import PrivacyPolicyPage from "../page";

describe("PrivacyPolicyPage", () => {
  it("describes Clarity analytics and links to the Microsoft Privacy Statement", () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole("heading", { name: "Website Analytics" })).toBeInTheDocument();
    expect(screen.getAllByText(/Microsoft Clarity/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/heatmaps, session replay/i)).toBeInTheDocument();
    expect(screen.getByText(/cookies and other tracking technologies/i)).toBeInTheDocument();
    expect(
      screen.getByText(/site optimization, troubleshooting, security review/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/marketing measurement/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Microsoft Privacy Statement" })).toHaveAttribute(
      "href",
      "https://privacy.microsoft.com/privacystatement"
    );
  });

  it("discloses Google Places review data and links to Google's privacy policy", () => {
    render(<PrivacyPolicyPage />);

    expect(
      screen.getByRole("heading", { name: "Google Places and Reviews" })
    ).toBeInTheDocument();
    expect(screen.getByText(/retrieve and display business information/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google Privacy Policy" })).toHaveAttribute(
      "href",
      "https://policies.google.com/privacy"
    );
  });

  it("distinguishes required online quote texts from promotional consent", () => {
    render(<PrivacyPolicyPage />);

    expect(
      screen.getByRole("heading", { name: "SMS and Mobile Messaging Privacy" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/online quote tool requires your agreement to receive text messages/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/does not include marketing or promotional texts/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not required to purchase goods or services/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/replying STOP/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms & SMS Policy" })).toHaveAttribute(
      "href",
      "/terms-and-conditions#sms-terms"
    );
  });
});
