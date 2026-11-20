/** @jest-environment node */
import { postReviewFeedback, type ReviewFeedbackPayload } from "../reviewFeedback";

const payload: ReviewFeedbackPayload = {
  version: 1,
  tenantSlug: "shed210",
  linkCode: "7KQ2M9XA",
  event: "rated",
  rating: 4,
  comment: null,
  occurredAt: 1_790_000_000_000,
};
const endpoint = "https://crm.example.convex.site/api/intake/shed-review-feedback";
const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });

function respond(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body });
}

describe("postReviewFeedback", () => {
  it("posts the event with the intake key and accepts only a recorded acknowledgement", async () => {
    respond(200, { ok: true, status: "recorded" });
    await expect(postReviewFeedback(endpoint, "shed-key", payload)).resolves.toBe("recorded");
    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: expect.objectContaining({ Authorization: "Bearer shed-key" }),
      body: JSON.stringify(payload),
    }));

    respond(200, { ok: true, status: "something-else" });
    await expect(postReviewFeedback(endpoint, "shed-key", payload)).resolves.toBe("unavailable");
  });

  it("reports unknown links separately from CRM outages", async () => {
    respond(404);
    await expect(postReviewFeedback(endpoint, "shed-key", payload)).resolves.toBe("not_found");
    respond(503);
    await expect(postReviewFeedback(endpoint, "shed-key", payload)).resolves.toBe("unavailable");
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(postReviewFeedback(endpoint, "shed-key", payload)).resolves.toBe("unavailable");
  });
});
