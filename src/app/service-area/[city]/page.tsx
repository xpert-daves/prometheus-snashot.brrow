import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, MapPin, MessageSquareText } from "lucide-react";
import { PHONE_DISPLAY, PHONE_NUMBER } from "@/lib/contact";
import { getPortfolioProjectsForCity } from "@/lib/portfolio";
import { listCrmProjects } from "@/lib/crmProjects.server";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import { getResolvedServiceAreaFromRegistry } from "@/lib/serviceAreaRegistry";
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildServiceAreaServiceJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import Container from "@/components/Container";
import TrackedActionLink from "@/components/TrackedActionLink";
import LocalProjectsSection from "@/components/LocalProjectsSection";
import RecentInstalls from "@/components/RecentInstalls";

type Params = { city: string };

export const revalidate = 3600;
export const dynamicParams = true;

const listProjectsForServiceArea = cache(listCrmProjects);

export async function generateStaticParams(): Promise<Params[]> {
  const serviceAreas = await listResolvedServiceAreas();
  return serviceAreas.map((area) => ({ city: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { city } = await params;
  const serviceAreas = await listResolvedServiceAreas();
  const area = getResolvedServiceAreaFromRegistry(serviceAreas, city);
  if (!area) {
    return {
      title: "Service Area Not Found",
      robots: { index: false, follow: false },
    };
  }

  const title = area.title;
  const description = area.description;
  const path = `/service-area/${area.slug}`;

  const metadata = buildPageMetadata({
    title,
    description,
    path,
    imageAlt: `Custom shed project service in ${area.city}, ${area.regionName}.`,
  });
  if (!area.curated) {
    const projects = await listProjectsForServiceArea(area.slug);
    if (projects.length === 0) {
      return {
        ...metadata,
        robots: { index: false, follow: true },
      };
    }
  }

  return metadata;
}

export default async function ServiceAreaCityPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { city } = await params;
  const serviceAreas = await listResolvedServiceAreas();
  const area = getResolvedServiceAreaFromRegistry(serviceAreas, city);
  if (!area) notFound();
  const nearbyAreas = area.nearbySlugs
    .map((slug) => getResolvedServiceAreaFromRegistry(serviceAreas, slug))
    .filter((nearby): nearby is NonNullable<typeof nearby> => Boolean(nearby));
  const localProjects = getPortfolioProjectsForCity(area.city);
  const crmProjects = await listProjectsForServiceArea(area.slug);

  const serviceJsonLd = buildServiceAreaServiceJsonLd({
    path: `/service-area/${area.slug}`,
    name: `Custom sheds in ${area.city}, ${area.regionName}`,
    description: area.description,
    area: {
      city: area.city,
      regionName: area.regionName,
      countryCode: area.countryCode,
    },
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Service Area", path: "/service-area" },
    { name: area.city, path: `/service-area/${area.slug}` },
  ]);

  return (
    <main id="main" tabIndex={-1} className="interior-page py-8 font-sans text-white sm:py-12 lg:py-16">
      <Container>
        <section className="interior-hero px-6 py-7 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="relative z-10">
            <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <Link
                href="/"
                className="underline decoration-white/35 underline-offset-2 transition hover:text-white"
              >
                Home
              </Link>
              <span aria-hidden="true">/</span>
              <Link
                href="/service-area"
                className="underline decoration-white/35 underline-offset-2 transition hover:text-white"
              >
                Service Area
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/80">{area.city}</span>
            </nav>

            <div className="grid gap-9 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end">
              <div>
                <p className="interior-kicker">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Serving {area.county}
                </p>
                <h1 className="brand-heading mb-0 mt-5 max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
                  Custom Sheds in <span className="text-[var(--accent-light)]">{area.city}</span>, {area.regionName}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                  {area.intro}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <TrackedActionLink
                    href="/quote"
                    eventName="quote_cta_clicked"
                    eventProperties={{ location: `${area.slug}_service_area_hero` }}
                    className="btn btn-primary btn-md gap-2 text-sm"
                  >
                    Get Instant Price
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </TrackedActionLink>
                  <TrackedActionLink
                    href={`sms:${PHONE_NUMBER}`}
                    eventName="text_click"
                    eventProperties={{ location: `${area.slug}_service_area_hero` }}
                    className="btn btn-outline btn-md gap-2 text-sm"
                  >
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                    Text {PHONE_DISPLAY}
                  </TrackedActionLink>
                </div>
              </div>

              <div className="interior-card-soft p-5 sm:p-6">
                <p className="motif-spec text-[0.66rem] text-[var(--accent-light)]">Local project brief</p>
                <h2 className="brand-subheading mb-0 mt-3 text-xl text-white">Local shed planning notes</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/68">
                  {area.planningNotes.map((note) => (
                    <li key={note} className="flex gap-3">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-light)]" aria-hidden="true" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/buildings"
                  className="brand-button mt-5 inline-flex items-center gap-2 text-xs text-[var(--accent-light)] transition hover:text-white"
                >
                  Compare building types
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl py-8 sm:py-10">

      {area.localAreas && area.localAreas.length > 0 ? (
        <section className="interior-card p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">San Antonio neighborhoods and nearby areas served</h2>
          <p className="mt-3 leading-7 text-white/62">
            Shed210 is a service-area builder. We list broad areas only, not customer addresses.
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
            {area.localAreas.map((localArea) => (
              <li key={localArea} className="interior-card-soft flex items-center gap-2 px-4 py-3">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-light)]" aria-hidden="true" />
                {localArea}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {area.deliveryCoverage ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">{area.deliveryCoverage.heading}</h2>
          <p className="mt-3 leading-7 text-white/62">{area.deliveryCoverage.description}</p>
          <ul className="mt-5 grid gap-3 text-white/72 sm:grid-cols-2">
            {area.deliveryCoverage.details.map((detail) => (
              <li key={detail} className="interior-card-soft flex gap-3 p-4">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-light)]" aria-hidden="true" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {crmProjects.length > 0 ? (
        <RecentInstalls
          city={area.city}
          citySlug={area.slug}
          projects={crmProjects}
        />
      ) : area.projectProofMode === "linked-gallery" ? (
        <LocalProjectsSection city={area.city} />
      ) : localProjects.length > 0 ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">Local project proof</h2>
          <p className="mt-3 leading-7 text-white/62">
            Recent customer-safe examples show city-level location, use case, and features without publishing exact addresses.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {localProjects.slice(0, 3).map((project) => (
              <article key={project.src} className="interior-card-soft p-5">
                <h3 className="brand-subheading mb-0 text-lg text-white">{project.caption}</h3>
                <dl className="mt-3 space-y-2 text-sm text-white/75">
                  <div>
                    <dt className="font-medium text-white">Location</dt>
                    <dd>{project.city}, TX</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-white">Size/use</dt>
                    <dd>
                      {project.size && project.useCase
                        ? `${project.size} for ${project.useCase}`
                        : "Details available on request"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-white">Features</dt>
                    <dd>{project.features?.length ? project.features.join(", ") : "Varies by build"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/gallery" className="brand-button inline-flex items-center gap-2 text-sm text-[var(--accent-light)] hover:text-white">
              View the full project gallery <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      {area.permitNotes && area.permitNotes.length > 0 ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">Permit and HOA guidance</h2>
          <div className="mt-5 grid gap-3 text-white/72 sm:grid-cols-2">
            {area.permitNotes.map((note) => (
              <div key={note.label} className="interior-card-soft p-5">
                <h3 className="brand-subheading mb-0 text-base text-white">{note.label}</h3>
                <p className="mt-2 text-sm leading-6">{note.text}</p>
                {note.href ? (
                  <a
                    href={note.href}
                    className="mt-1 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Official source
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {area.relatedGuides && area.relatedGuides.length > 0 ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">{area.city} shed planning guides</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {area.relatedGuides.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="interior-card-soft interior-link-card group p-5"
              >
                <span className="brand-subheading flex items-center justify-between gap-3 text-[var(--accent-light)]">
                  {guide.title}
                  <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
                <span className="mt-3 block text-sm leading-6 text-white/62">{guide.description}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="interior-card p-5 sm:p-7">
          <p className="motif-spec text-[0.65rem] text-[var(--accent-light)]">01 · Site</p>
          <h2 className="brand-subheading mb-0 mt-3 text-xl text-white">Access and placement</h2>
          <p className="mt-3 leading-7 text-white/62">{area.accessNote}</p>
        </section>
        <section className="interior-card p-5 sm:p-7">
          <p className="motif-spec text-[0.65rem] text-[var(--accent-light)]">02 · Timing</p>
          <h2 className="brand-subheading mb-0 mt-3 text-xl text-white">Scheduling</h2>
          <p className="mt-3 leading-7 text-white/62">{area.schedulingNote}</p>
        </section>
      </div>

      {area.processSteps && area.processSteps.length > 0 ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <p className="interior-kicker">From quote to build day</p>
          <h2 className="brand-subheading mb-0 mt-4 text-xl text-white sm:text-2xl">How the local build process works</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {area.processSteps.map((step, index) => (
              <li key={step.title} className="interior-card-soft p-5">
                <p className="motif-spec text-[0.68rem] text-[var(--accent-light)]">
                  Step {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="brand-subheading mb-0 mt-3 text-lg text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {area.warrantyNotes && area.warrantyNotes.length > 0 ? (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">Warranty and buying confidence</h2>
          <ul className="mt-5 grid gap-3 text-white/72 sm:grid-cols-2">
            {area.warrantyNotes.map((note) => (
              <li key={note} className="interior-card-soft flex gap-3 p-4">
                <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-light)]" aria-hidden="true" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="interior-card mt-5 p-5 sm:p-7">
        <p className="interior-kicker">Straight answers</p>
        <h2 className="brand-subheading mb-0 mt-4 text-xl text-white sm:text-2xl">{area.city} shed questions</h2>
        <dl className="mt-5 grid gap-3 text-white/72 sm:grid-cols-2">
          {area.faqs.map((faq) => (
            <div key={faq.question} className="interior-card-soft p-5">
              <dt className="brand-subheading text-base text-white">{faq.question}</dt>
              <dd className="mt-2 text-sm leading-6 text-white/62">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {nearbyAreas.length > 0 && (
        <section className="interior-card mt-5 p-5 sm:p-7">
          <h2 className="brand-subheading mb-0 text-xl text-white sm:text-2xl">Nearby service areas</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {nearbyAreas.map((nearby) => (
              <Link
                key={nearby.slug}
                href={`/service-area/${nearby.slug}`}
                className="brand-button rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-xs text-white/75 transition hover:border-amber-400/40 hover:text-white"
              >
                {nearby.city}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(255,122,26,0.16),rgba(255,255,255,0.045)_42%,rgba(19,20,22,0.96))] p-6 sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="interior-kicker">Ready when you are</p>
            <h2 className="brand-heading mb-0 mt-4 text-3xl text-white">Start your project</h2>
            <p className="mt-3 max-w-2xl leading-7 text-white/65">
              Use our quote builder for instant pricing or call/text for a quick walkthrough of your lot and design goals.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <TrackedActionLink
              href="/quote"
              eventName="quote_cta_clicked"
              eventProperties={{ location: `${area.slug}_service_area_footer` }}
              className="btn btn-primary btn-md text-sm"
            >
              Get Instant Price
            </TrackedActionLink>
            <Link href="/gallery" className="btn btn-outline btn-md text-sm">
              View Our Work
            </Link>
            <TrackedActionLink
              href={`sms:${PHONE_NUMBER}`}
              eventName="text_click"
              eventProperties={{ location: `${area.slug}_service_area_footer` }}
              className="btn btn-outline btn-md text-sm"
            >
              Text {PHONE_DISPLAY}
            </TrackedActionLink>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
        </div>
      </Container>
    </main>
  );
}
