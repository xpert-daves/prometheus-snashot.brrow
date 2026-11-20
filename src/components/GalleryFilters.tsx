"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";

type GalleryFilterCity = {
  slug: string;
  city: string;
  count: number;
};

type GalleryFilterProjectType = {
  projectType: string;
  count: number;
};

type GalleryFiltersProps = {
  cities: readonly GalleryFilterCity[];
  projectTypes: readonly GalleryFilterProjectType[];
  selectedCity?: string;
  selectedProjectType?: string;
};

export default function GalleryFilters({
  cities,
  projectTypes,
  selectedCity,
  selectedProjectType,
}: GalleryFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectedCityIsKnown = cities.some(
    (city) => city.slug === selectedCity
  );
  const normalizedSelectedProjectType = projectTypes.find(
    ({ projectType }) =>
      projectType.toLowerCase() === selectedProjectType?.toLowerCase()
  )?.projectType;
  const [cityValue, setCityValue] = useState(
    selectedCityIsKnown ? selectedCity ?? "" : ""
  );
  const [projectTypeValue, setProjectTypeValue] = useState(
    normalizedSelectedProjectType ?? ""
  );

  useEffect(() => {
    setCityValue(selectedCityIsKnown ? selectedCity ?? "" : "");
    setProjectTypeValue(normalizedSelectedProjectType ?? "");
  }, [
    normalizedSelectedProjectType,
    selectedCity,
    selectedCityIsKnown,
  ]);

  const hasActiveFilters = Boolean(cityValue || projectTypeValue);
  const allCitiesCount = cities.reduce(
    (total, city) => total + city.count,
    0
  );
  const allProjectTypesCount = projectTypes.reduce(
    (total, projectType) => total + projectType.count,
    0
  );

  function navigate(nextCity: string, nextProjectType: string) {
    const params = new URLSearchParams();
    if (nextCity) params.set("city", nextCity);
    if (nextProjectType) params.set("type", nextProjectType);
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `/gallery?${query}` : "/gallery", {
        scroll: false,
      });
    });
  }

  function handleCityChange(nextCity: string) {
    const nextCityCount =
      cities.find((city) => city.slug === nextCity)?.count ?? allCitiesCount;
    const nextProjectType =
      projectTypeValue && nextCityCount === 0 ? "" : projectTypeValue;

    setCityValue(nextCity);
    setProjectTypeValue(nextProjectType);
    navigate(nextCity, nextProjectType);
  }

  function handleProjectTypeChange(nextProjectType: string) {
    setProjectTypeValue(nextProjectType);
    navigate(cityValue, nextProjectType);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(cityValue, projectTypeValue);
  }

  return (
    <form
      action="/gallery"
      method="get"
      onSubmit={handleSubmit}
      className="interior-card-soft grid gap-4 p-4 sm:grid-cols-2 sm:items-end sm:p-5"
      aria-label="Filter project gallery"
      aria-busy={isPending}
    >
      <label className="block">
        <span className="motif-spec mb-2 block text-[0.62rem] text-white/55">
          City
        </span>
        <select
          name="city"
          value={cityValue}
          disabled={isPending}
          onChange={(event) => handleCityChange(event.target.value)}
          className="mb-0 w-full rounded-xl border border-white/12 bg-[#0b0c0e] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/45 focus:ring-2 focus:ring-amber-400/10"
        >
          <option value="">All cities ({allCitiesCount})</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.city} ({city.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="motif-spec mb-2 block text-[0.62rem] text-white/55">
          Project type
        </span>
        <select
          name="type"
          value={projectTypeValue}
          disabled={isPending}
          onChange={(event) => handleProjectTypeChange(event.target.value)}
          className="mb-0 w-full rounded-xl border border-white/12 bg-[#0b0c0e] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/45 focus:ring-2 focus:ring-amber-400/10"
        >
          <option value="">All project types ({allProjectTypesCount})</option>
          {projectTypes.map(({ projectType, count }) => (
            <option
              key={projectType}
              value={projectType}
              disabled={count === 0 && projectType !== projectTypeValue}
            >
              {projectType} ({count})
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-h-5 items-center justify-between gap-3 sm:col-span-2">
        <p
          className="text-xs text-white/45"
          role="status"
          aria-live="polite"
        >
          {isPending ? "Updating projects…" : "Filters update instantly."}
        </p>
        {hasActiveFilters ? (
          <Link
            href="/gallery"
            scroll={false}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/65 transition hover:text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
