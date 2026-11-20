import { fireEvent, render, screen } from "@testing-library/react";
import WebsiteMeasurementPreference from "../WebsiteMeasurementPreference";
import { WEBSITE_MEASUREMENT_OPT_OUT_KEY } from "@/lib/websiteMeasurement";

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
});

afterEach(() => jest.restoreAllMocks());

it("provides a visible browser preference without claiming to disable other analytics", () => {
  render(<WebsiteMeasurementPreference />);
  fireEvent.click(screen.getByRole("button", { name: "Disable first-party measurement" }));
  expect(localStorage.getItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY)).toBe("true");
  expect(screen.getByText(/First-party website measurement: disabled/)).toBeInTheDocument();
  expect(screen.getByText(/does not change the existing third-party/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enable first-party measurement" }));
  expect(localStorage.getItem(WEBSITE_MEASUREMENT_OPT_OUT_KEY)).toBe("false");
});

it("cannot override Global Privacy Control by enabling measurement", () => {
  Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
  render(<WebsiteMeasurementPreference />);
  fireEvent.click(screen.getByRole("button", { name: "Enable first-party measurement" }));
  expect(screen.getByText(/First-party website measurement: disabled/)).toBeInTheDocument();
});

it("explains when blocked browser storage cannot save the preference", () => {
  render(<WebsiteMeasurementPreference />);
  jest.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  fireEvent.click(screen.getByRole("button", { name: "Disable first-party measurement" }));
  expect(screen.getByRole("alert")).toHaveTextContent("This browser could not save the preference.");
  expect(screen.getByText(/First-party website measurement: disabled/)).toBeInTheDocument();
});
