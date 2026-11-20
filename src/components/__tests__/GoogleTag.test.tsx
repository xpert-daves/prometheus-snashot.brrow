import { render } from "@testing-library/react";
import GoogleTag from "../GoogleTag";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({
    id,
    src,
    strategy,
    children,
  }: {
    id?: string;
    src?: string;
    strategy?: string;
    children?: string;
  }) => (
    <div data-testid="next-script" data-id={id} data-src={src} data-strategy={strategy}>
      {children}
    </div>
  ),
}));

describe("GoogleTag", () => {
  it("renders the gtag loader and config when enabled", () => {
    const { getAllByTestId } = render(<GoogleTag enabled />);

    const [loader, init] = getAllByTestId("next-script");
    expect(getAllByTestId("next-script")).toHaveLength(2);
    expect(loader).toHaveAttribute(
      "data-src",
      "https://www.googletagmanager.com/gtag/js?id=G-N8R0RDXRM0",
    );
    expect(loader).toHaveAttribute("data-strategy", "lazyOnload");
    expect(init).toHaveAttribute("data-id", "gtag-init");
    expect(init).toHaveAttribute("data-strategy", "lazyOnload");
    expect(init).toHaveTextContent("window.gtag('config', 'G-N8R0RDXRM0');");
  });

  it("does not render when disabled", () => {
    const { container, queryAllByTestId } = render(<GoogleTag enabled={false} />);

    expect(queryAllByTestId("next-script")).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();
  });
});
