import type { Metadata, Viewport } from "next";
import QuotePageClient from "@/components/QuotePageClient";
import { buildPageMetadata } from "@/lib/seo";

// Phones run the quote flow as a full-screen app; tint the browser chrome to
// match. viewport-fit stays default so landscape phones (desktop layout) keep
// Safari's safe-area letterboxing.
export const viewport: Viewport = {
  themeColor: [{ media: "(max-width: 47.99rem)", color: "#0a0a0b" }],
};

const title = "Shed Quote Calculator in San Antonio";
const description =
  "Get instant shed pricing for San Antonio and nearby areas. Customize size, style, doors, windows, and build location details in minutes.";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/quote",
  imageAlt: "Instant shed quote calculator by Shed210.",
});

export default function QuotePage() {
  return (
    <main id="main" tabIndex={-1}>
      <QuotePageClient />
    </main>
  );
}
