import { render, screen } from "@testing-library/react";
import ServiceAreaSection from "@/components/ServiceAreaSection";

describe("ServiceAreaSection", () => {
  it("frames the 35-mile benefit as a distance fee rather than delivery", () => {
    render(<ServiceAreaSection />);

    expect(
      screen.getByText("No Distance Fee Within 35 Miles"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/35-mile no-distance-fee service area/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/service availability is confirmed by build address/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delivery availability/i)).not.toBeInTheDocument();
  });
});
