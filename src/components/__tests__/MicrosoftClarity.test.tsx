import { render } from "@testing-library/react";
import MicrosoftClarity from "../MicrosoftClarity";

describe("MicrosoftClarity", () => {
  it("renders the Clarity loader on public pages when enabled", () => {
    render(<MicrosoftClarity enabled />);

    const script = document.getElementById("microsoft-clarity");
    expect(script).not.toBeNull();
    expect(script).toHaveTextContent("https://www.clarity.ms/tag/");
    expect(script).toHaveTextContent("xijsk7z6i2");
    expect(script).toHaveTextContent('pathname.indexOf("/admin") === 0');
  });

  it("does not render when disabled", () => {
    render(<MicrosoftClarity enabled={false} />);

    expect(document.getElementById("microsoft-clarity")).toBeNull();
  });
});
