import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin, Ruler, Timer } from "lucide-react";
import Container from "@/components/Container";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import { buildPageMetadata } from "@/lib/seo";

const title = "Shed Service Areas Near San Antonio";
const description =
  "Explore Shed210 custom shed service areas across San Antonio, the Hill Country, Medina County, Guadalupe County, and South Central Texas.";

export const metadata: Metadata = buildPageMetadata({
  title,
  description,
  path: "/service-area",
  imageAlt: "Shed210 service areas around San Antonio.",
});

export const revalidate = 3600;

export default async function ServiceAreaPage() {
  const serviceAreas = await listResolvedServiceAreas();

  return (
    <main id="main" tabIndex={-1} className="interior-page py-10 font-sans text-white sm:py-14 lg:py-20">
      <Container>
        <section className="interior-hero px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-14">
          <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)] lg:items-end">
            <div>
              <p className="interior-kicker">Local service coverage</p>
              <h1 className="brand-heading mb-0 mt-5 max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
                Built Local.
                <span className="block text-[var(--accent-light)]">Built On-Site Across the Region.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                We build custom sheds across San Antonio and nearby communities. Choose
                your city for local planning notes, service details, and quick quote access.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
              {[
                { icon: MapPin, value: `${serviceAreas.length}`, label: "cities served" },
                { icon: Ruler, value: "35 mi", label: "no distance fee" },
                { icon: Timer, value: "1 day", label: "typical build" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="interior-card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Icon className="h-5 w-5 text-[var(--accent-light)]" aria-hidden="true" />
                  <div>
                    <span className="brand-subheading block text-lg text-white">{value}</span>
                    <span className="motif-spec text-[0.62rem] text-white/60">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="coverage-heading">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="interior-kicker">Find your city</p>
              <h2 id="coverage-heading" className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl">
                Service Area Directory
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/55">
              Each local page includes build access, scheduling, and service-area guidance. Curated pages also include sourced local planning details where available.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serviceAreas.map((area, index) => (
              <li key={area.slug}>
                <Link
                  href={`/service-area/${area.slug}`}
                  className="interior-card interior-link-card group flex h-full min-h-48 flex-col p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="motif-spec text-[0.65rem] text-white/60">
                      {String(index + 1).padStart(2, "0")} / {serviceAreas.length}
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition group-hover:border-amber-400/40 group-hover:bg-amber-400 group-hover:text-black">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <span className="brand-subheading mt-8 block text-xl text-white">{area.city}, {area.regionCode}</span>
                  <span className="mt-3 block text-sm leading-6 text-white/58">
                    {area.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </main>
  );
}
