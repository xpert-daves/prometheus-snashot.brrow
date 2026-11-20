import { normalizePublicProjectCopy } from "@/lib/publicProjectCopy";

describe("public CRM project copy", () => {
  it("reframes portable-building and install language around completed builds", () => {
    expect(
      normalizePublicProjectCopy(
        "10x12x10 Barn Style Portable Building shed installed in Shady Oaks, TX"
      )
    ).toBe("10x12x10 Barn Style Shed built in Shady Oaks, TX");
    expect(
      normalizePublicProjectCopy(
        "This project includes two custom portable buildings with delivery details confirmed by address."
      )
    ).toBe(
      "This project includes two custom sheds with service-area details confirmed by address."
    );
  });

  it("keeps genuine material and component work accurate", () => {
    expect(
      normalizePublicProjectCopy(
        "Materials were delivered before the crew installed the windows."
      )
    ).toBe("Materials arrived before the crew installed the windows.");
  });
});
