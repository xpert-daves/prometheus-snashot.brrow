import Image from "next/image";
import Link from "next/link";

import { getPortfolioProjectsForCity } from "@/lib/portfolio";

type LocalProjectsSectionProps = {
  city: string;
};

export default function LocalProjectsSection({ city }: LocalProjectsSectionProps) {
  const projects = getPortfolioProjectsForCity(city).slice(0, 3);

  if (projects.length === 0) return null;

  return (
    <section className="interior-card mt-5 p-5 sm:p-7">
      <p className="interior-kicker">Real local builds</p>
      <h2 className="brand-subheading mb-0 mt-4 text-xl text-white sm:text-2xl">Completed {city} shed projects</h2>
      <p className="mt-3 max-w-3xl leading-7 text-white/62">
        These customer-safe examples use city-level details and the same photos shown in our
        completed-project gallery. We never publish a customer&apos;s street address.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.src}
            href="/gallery"
            aria-label={`View ${project.caption} in the completed shed project gallery`}
            className="interior-card-soft interior-link-card group overflow-hidden"
          >
            <article>
              <div className="relative aspect-[4/3] overflow-hidden bg-black">
                <Image
                  src={project.src}
                  alt={project.alt}
                  fill
                  sizes="(max-width: 639px) calc(100vw - 72px), 392px"
                  quality={75}
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="brand-subheading mb-0 text-lg text-white">{project.caption}</h3>
                <p className="motif-spec mt-2 text-[0.62rem] text-[var(--accent-light)]">
                  {project.city}, TX · {project.projectType}
                </p>
                <p className="mt-3 text-sm text-white/72">
                  {project.size} for {project.useCase}.
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Features: {project.features.join(", ")}
                </p>
                <span className="brand-button mt-4 inline-flex text-xs text-[var(--accent-light)] transition group-hover:text-white">
                  View this completed project in the full gallery →
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
