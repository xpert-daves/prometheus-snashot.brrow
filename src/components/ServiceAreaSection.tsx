import Link from "next/link";
import Container from "./Container";
import DimensionDivider from "./motif/DimensionDivider";
import SpecTag from "./motif/SpecTag";
import StaticServiceAreaMap from "./StaticServiceAreaMap";
import { homeSectionTheme } from "@/lib/theme/homeSectionTheme";
import type { ServiceAreaMapLocation } from "@/lib/serviceAreaRegistry";

export default function ServiceAreaSection({
  locations,
}: {
  locations?: readonly ServiceAreaMapLocation[];
}) {
  const theme = homeSectionTheme.serviceAreaSection;

  return (
    <section
      aria-labelledby="service-area"
      data-theme="warm-industrial"
      data-section-tone={theme.tone}
      className="relative isolate overflow-hidden border-b py-14 sm:py-20 lg:py-24"
      style={{ background: theme.sectionBg, borderColor: theme.borderTone }}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: theme.topGlow }}
      />
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <SpecTag className="mb-4">San Antonio Metro + Hill Country</SpecTag>
          <h2
            id="service-area"
            className="brand-heading mb-0 text-4xl sm:text-5xl"
            style={{ color: theme.headingTone }}
          >
            Where We Build
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7"
            style={{ color: theme.chipTone }}
          >
            Pick your city under the map for local details. Service availability
            is confirmed by build address.
          </p>
        </div>
        <div
          className="motif-corners mx-auto mt-8 max-w-5xl border p-3 sm:mt-10"
          style={{
            borderColor: theme.borderTone,
            backgroundColor: theme.surfaceBg,
          }}
        >
          <StaticServiceAreaMap
            locations={locations}
            priority={false}
            showCityLinks
          />
          <DimensionDivider
            className="mt-4 px-1"
            label="No Distance Fee Within 35 Miles"
          />
          <div
            className="mt-3 flex flex-col gap-3 px-1 pb-1 text-sm leading-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ color: theme.chipTone }}
          >
            <p className="mb-0">
              The map shows our 35-mile no-distance-fee service area. We&apos;ll
              confirm your address before scheduling.
            </p>
            <Link
              href="/service-area"
              className="brand-button shrink-0 text-sm text-amber-300 transition hover:text-amber-200"
            >
              Explore all service areas{" "}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
