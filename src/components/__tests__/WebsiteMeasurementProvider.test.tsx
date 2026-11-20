import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import WebsiteMeasurementProvider from "../WebsiteMeasurementProvider";

let mockPathname = "/quote";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
const originalFetch = global.fetch;
const events = () => (global.fetch as jest.Mock).mock.calls.flatMap(([, request]) => JSON.parse(request.body).events);
const drain = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  jest.useFakeTimers();
  mockPathname = "/quote"; window.history.replaceState({}, "", mockPathname);
  localStorage.clear(); sessionStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it("does not treat quote page load or passive focus as a started or completed quote", async () => {
  render(<><WebsiteMeasurementProvider /><form id="quote-active-step-form"><input aria-label="Width" defaultValue="10" /></form></>);
  await drain();
  const input = screen.getByLabelText("Width");
  fireEvent.focus(input); await drain();
  expect(events().map(event => event.name)).toEqual(["page_view"]);
  fireEvent.input(input, { target: { value: "12" } }); await drain();
  fireEvent.change(input, { target: { value: "14" } }); await drain();
  fireEvent.submit(input.closest("form")!); await drain();
  expect(events().filter(event => event.name === "form_start")).toHaveLength(1);
  expect(events().some(event => ["goal_completed", "crm_accepted"].includes(event.name))).toBe(false);
});

it("uses one delegated click event even when Next Link has prevented native navigation", async () => {
  render(<StrictMode><WebsiteMeasurementProvider /><a href="/quote?customer=secret" onClick={event => event.preventDefault()}>Quote CTA</a><a href="tel:+12105551234" onClick={event => event.preventDefault()}>Call</a></StrictMode>);
  await drain();
  expect(events().filter(event => event.name === "page_view")).toHaveLength(1);
  fireEvent.click(screen.getByRole("link", { name: "Quote CTA" })); await drain();
  fireEvent.click(screen.getByRole("link", { name: "Call" })); await drain();
  const clicks = events().filter(event => event.name === "action_click");
  expect(clicks).toHaveLength(2);
  expect(clicks.map(event => [event.offer, event.cta])).toEqual([["quote", "quote-link"], ["phone", "phone-link"]]);
  expect(JSON.stringify(clicks)).not.toMatch(/secret|12105551234/);
});

it("records distinct project navigation with canonical paths and removes listeners on unmount", async () => {
  mockPathname = "/projects/austin/private-customer";
  window.history.replaceState({}, "", mockPathname);
  const view = render(<WebsiteMeasurementProvider />); await drain();
  mockPathname = "/projects/boerne/another-customer";
  window.history.replaceState({}, "", mockPathname);
  view.rerender(<WebsiteMeasurementProvider />); await drain();
  expect(events().map(event => [event.name, event.path, event.offer])).toEqual([["page_view", "/gallery", "projects"], ["page_view", "/gallery", "projects"]]);
  expect(JSON.stringify(events())).not.toMatch(/customer|austin|boerne/);
  view.unmount();
  const a = document.createElement("a"); a.href = "/contact"; document.body.append(a);
  fireEvent.click(a); await drain(); a.remove();
  expect(events()).toHaveLength(2);
});
