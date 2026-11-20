import type { Metadata } from "next";
import Hero from '@/components/hero'
import ValuePropsBar from '@/components/ValuePropsBar'
import HomeBuildingPicker from '@/components/HomeBuildingPicker'
import PortfolioSection from '@/components/PortfolioSection'
import HowItWorks from '@/components/HowItWorks'
import ServiceAreaSection from '@/components/ServiceAreaSection'
import CTA from '@/components/CTA'
import FAQ from '@/components/FAQ'
import { listCrmHomepageProjects } from "@/lib/crmProjects.server";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import { toServiceAreaMapLocations } from "@/lib/serviceAreaRegistry";
import {
  DEFAULT_OG_IMAGE,
  buildPageMetadata,
  buildServiceAreaBusinessJsonLd,
  buildWebsiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo";

// Leads with the queries Search Console shows the homepage close to ranking for.
const title = "Shed Builder in San Antonio, TX | Storage & Metal Sheds";
const description =
  "San Antonio shed builder for custom storage and metal sheds, built on-site in as little as one day. Instant online pricing and no final payment until complete.";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/",
  imageAlt: "Custom shed built on-site by Shed210.",
});

export const revalidate = 3600;

const DEFAULT_HERO_VIDEO_WEBM_SRC = "/hero-background.webm";
const DEFAULT_HERO_VIDEO_MP4_SRC = "/hero-background.mp4";
const DEFAULT_HERO_FULL_VIDEO_SRC = "/shed-build-day.mp4";
const DEFAULT_HERO_FULL_VIDEO_FALLBACK_URL =
  "https://www.facebook.com/shed210/videos/1582687942854176/";

function matchesVideoExtension(src: string | undefined, extension: string) {
  return src?.split(/[?#]/, 1)[0].toLowerCase().endsWith(extension) ?? false;
}

export default async function Home() {
  const [galleryProjects, serviceAreas] = await Promise.all([
    listCrmHomepageProjects(),
    listResolvedServiceAreas(),
  ]);
  const mapLocations = toServiceAreaMapLocations(serviceAreas);
  const localBusinessJsonLd = buildServiceAreaBusinessJsonLd({
    image: DEFAULT_OG_IMAGE,
    areaServed: serviceAreas.map((area) => ({
      city: area.city,
      regionName: area.regionName,
      countryCode: area.countryCode,
    })),
  });
  // Built alongside the business node so both read the same site URL.
  const websiteJsonLd = buildWebsiteJsonLd();
  const legacyHeroVideoSrc = process.env.NEXT_PUBLIC_HERO_VIDEO_SRC?.trim();
  const heroVideoWebmSrc =
    process.env.NEXT_PUBLIC_HERO_VIDEO_WEBM_SRC?.trim() ||
    (legacyHeroVideoSrc && matchesVideoExtension(legacyHeroVideoSrc, ".webm")
      ? legacyHeroVideoSrc
      : DEFAULT_HERO_VIDEO_WEBM_SRC);
  const heroVideoMp4Src =
    process.env.NEXT_PUBLIC_HERO_VIDEO_MP4_SRC?.trim() ||
    (legacyHeroVideoSrc && matchesVideoExtension(legacyHeroVideoSrc, ".mp4")
      ? legacyHeroVideoSrc
      : DEFAULT_HERO_VIDEO_MP4_SRC);
  const heroFullVideoSrc =
    process.env.NEXT_PUBLIC_HERO_FULL_VIDEO_SRC?.trim() ||
    DEFAULT_HERO_FULL_VIDEO_SRC;
  const heroVideoSources = [
    { src: heroVideoWebmSrc, type: "video/webm" as const },
    { src: heroVideoMp4Src, type: "video/mp4" as const },
  ];

  return (
    <main id="main" tabIndex={-1} className="font-sans">
      <Hero
        backgroundVideoSources={heroVideoSources}
        fullVideoSrc={heroFullVideoSrc}
        fullVideoFallbackUrl={DEFAULT_HERO_FULL_VIDEO_FALLBACK_URL}
      />
      <ValuePropsBar />
      <HomeBuildingPicker />
      <PortfolioSection projects={galleryProjects} />
      <HowItWorks />
      <ServiceAreaSection locations={mapLocations} />
      <FAQ />
      <CTA />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
      />
    </main>
  );
}
