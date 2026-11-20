import { loadVercelInsights } from "@/lib/vercelInsights";

export type AllowedPropertyValues = string | number | boolean | null;
export type EventProperties = Record<string, AllowedPropertyValues>;

type GtagPropertyValues = string | number | boolean;
type GtagEventProperties = Record<string, GtagPropertyValues>;

const GA4_PROPERTY_ALLOWLIST = new Set(["location", "category"]);

type Gtag = {
  (command: "js", date: Date): void;
  (command: "config", measurementId: string, config?: Record<string, unknown>): void;
  (command: "event", eventName: string, parameters?: GtagEventProperties): void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

export function toGtagEventProperties(properties?: EventProperties): GtagEventProperties | undefined {
  if (!properties) return undefined;

  const entries = Object.entries(properties).filter(
    (entry): entry is [string, GtagPropertyValues] =>
      GA4_PROPERTY_ALLOWLIST.has(entry[0]) && entry[1] !== null
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function trackEvent(name: string, properties?: EventProperties) {
  if (process.env.NODE_ENV === "test") return;
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, toGtagEventProperties(properties));
  }

  void loadVercelInsights()
    .then((analytics) => {
      analytics?.track(name, properties);
    })
    .catch(() => {
      // ignore failures, analytics is optional
    });
}
