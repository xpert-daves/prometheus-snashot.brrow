import type { Metadata } from "next";
import ContactPageClient from "@/components/ContactPageClient";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import { toServiceAreaMapLocations } from "@/lib/serviceAreaRegistry";
import {
  buildContactPageJsonLd,
  buildPageMetadata,
  serializeJsonLd,
} from "@/lib/seo";

const title = "Contact Shed Builders in San Antonio";
const description =
  "Call, text, or message Shed210 for one-day custom shed projects in San Antonio, Schertz, Cibolo, New Braunfels, Boerne, and nearby areas.";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/contact",
  imageAlt: "Shed210 custom shed built on-site in San Antonio.",
});

export const revalidate = 3600;

export default async function ContactPage() {
  const serviceAreas = await listResolvedServiceAreas();
  const contactJsonLd = buildContactPageJsonLd({
    path: "/contact",
    name: title,
    description,
  });

  return (
    <main id="main" tabIndex={-1}>
      <ContactPageClient locations={toServiceAreaMapLocations(serviceAreas)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(contactJsonLd) }}
      />
    </main>
  );
}
