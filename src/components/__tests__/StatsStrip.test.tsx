import { render, screen } from "@testing-library/react";
import StatsStrip from "@/components/StatsStrip";

describe("StatsStrip", () => {
  it("points to local project details without an unverified lifetime count", () => {
    render(<StatsStrip />);

    expect(screen.getByText("Photos & Build Details")).toBeInTheDocument();
    expect(screen.queryByText("100+")).not.toBeInTheDocument();
    expect(screen.queryByText(/projects delivered/i)).not.toBeInTheDocument();
  });
});
