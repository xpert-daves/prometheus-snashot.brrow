import type { Metadata } from "next";
import { BUILDING_CATALOG } from "@/lib/buildingCatalog";
import { EMAIL, PHONE_NUMBER, SERVICE_AREAS, SITE_NAME, SOCIAL_LINKS } from "@/lib/contact";

export const DEFAULT_SITE_URL = "https://www.shed210.com";
export const DEFAULT_OG_IMAGE = "/portfolio/IMG_6287.jpeg";

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdObject
  | JsonLdValue[];

export type JsonLdObject = {
  [key: string]: JsonLdValue;
};

export function serializeJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type BreadcrumbJsonLdItem = {
  name: string;
  path: string;
};

export type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt: string;
};

// The most specific schema.org type for a shed builder; it is a LocalBusiness subtype.
export const BUSINESS_SCHEMA_TYPE = "HomeAndConstructionBusiness";

// The Google Business Profile lists the business as "Shed 210".
const BUSINESS_ALTERNATE_NAMES = ["Shed 210"];

// Hand-written copy: seo.test.ts fails if a BUILDING_CATALOG type is missing from it.
const BUSINESS_DESCRIPTION =
  "Shed builder serving San Antonio and nearby Texas communities with custom metal storage sheds and garages, polycarbonate greenhouses, water well sheds, loafing sheds, and carports built on-site.";

const BUSINESS_REFERENCE_ID = "/#localbusiness";

const HOA_PLANNING_SERVICE = {
  name: "Shed planning for HOA requirements",
  description:
    "Help gathering the property, placement, and design details an HOA or city review asks for before a build is scheduled.",
} as const;

// Built from the public building catalog so the schema lists every building type the site sells.
function buildBuildingServiceJsonLd(
  building: (typeof BUILDING_CATALOG)[number]
): JsonLdObject {
  const url = absoluteUrl(`/buildings#${building.value}`);
  return {
    "@type": "Service",
    "@id": url,
    name: building.title,
    description: building.summary,
    url,
  };
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalized, getSiteUrl()).toString();
}

export function canonicalHost(): string {
  return new URL(getSiteUrl()).host;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  imageAlt,
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

type JsonLdServiceArea =
  | string
  | { city: string; regionName: string; countryCode?: string };

function cityAreaServed(area: JsonLdServiceArea): JsonLdObject {
  const city = typeof area === "string" ? area : area.city;
  const regionName = typeof area === "string" ? "Texas" : area.regionName;
  return {
    "@type": "City",
    name: city,
    containedInPlace: {
      "@type": "State",
      name: regionName,
    },
  };
}

// The one full business node. Only the homepage renders it (seoBusinessNode.test.ts
// enforces this); every other page points at it with buildBusinessReferenceJsonLd so
// search engines never see two versions of the business.
export function buildServiceAreaBusinessJsonLd(options?: {
  areaServed?: readonly JsonLdServiceArea[];
  image?: string;
}): JsonLdObject {
  const image = options?.image ?? DEFAULT_OG_IMAGE;
  const areas = options?.areaServed ?? SERVICE_AREAS.map((area) => area.city);

  // Services inherit the business's areaServed instead of repeating every city.
  const services: JsonLdObject[] = [
    ...BUILDING_CATALOG.map(buildBuildingServiceJsonLd),
    { "@type": "Service", ...HOA_PLANNING_SERVICE },
  ];

  return {
    "@context": "https://schema.org",
    "@type": BUSINESS_SCHEMA_TYPE,
    "@id": absoluteUrl(BUSINESS_REFERENCE_ID),
    name: SITE_NAME,
    alternateName: BUSINESS_ALTERNATE_NAMES,
    description: BUSINESS_DESCRIPTION,
    url: absoluteUrl("/"),
    mainEntityOfPage: absoluteUrl("/"),
    telephone: PHONE_NUMBER,
    email: EMAIL,
    image: absoluteUrl(image),
    hasMap: SOCIAL_LINKS.google,
    areaServed: areas.map(cityAreaServed),
    sameAs: [SOCIAL_LINKS.google, SOCIAL_LINKS.facebook],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Custom shed and building services",
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: service,
      })),
    },
  };
}

// Points at the homepage business node by id. The type and name let a page that
// does not render the full node still say what the reference is.
export function buildBusinessReferenceJsonLd(): JsonLdObject {
  return {
    "@type": BUSINESS_SCHEMA_TYPE,
    "@id": absoluteUrl(BUSINESS_REFERENCE_ID),
    name: SITE_NAME,
    url: absoluteUrl("/"),
  };
}

// A city page describes the local shed service; the business itself stays on the homepage.
export function buildServiceAreaServiceJsonLd({
  path,
  name,
  description,
  area,
}: {
  path: string;
  name: string;
  description: string;
  area: JsonLdServiceArea;
}): JsonLdObject {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name,
    description,
    url,
    serviceType: "Custom shed building",
    areaServed: cityAreaServed(area),
    provider: buildBusinessReferenceJsonLd(),
  };
}

export function buildContactPageJsonLd({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}): JsonLdObject {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": url,
    name,
    description,
    url,
    mainEntity: buildBusinessReferenceJsonLd(),
  };
}

export function buildBuildingServicesJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Shed210 building types",
    itemListElement: BUILDING_CATALOG.map((building, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        ...buildBuildingServiceJsonLd(building),
        serviceType: building.quoteLabel,
        provider: buildBusinessReferenceJsonLd(),
      },
    })),
  };
}

export type BlogJsonLdArticle = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  modifiedDate?: string;
};

export function buildBlogJsonLd({
  name,
  description,
  articles,
}: {
  name: string;
  description: string;
  articles: readonly BlogJsonLdArticle[];
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": absoluteUrl("/news#blog"),
    name,
    description,
    url: absoluteUrl("/news"),
    publisher: buildBusinessReferenceJsonLd(),
    blogPost: articles.map((article) => ({
      "@type": "BlogPosting",
      headline: article.title,
      description: article.excerpt,
      url: absoluteUrl(`/news/${article.slug}`),
      datePublished: article.date,
      dateModified: article.modifiedDate || article.date,
    })),
  };
}

export function buildWebsiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    alternateName: BUSINESS_ALTERNATE_NAMES,
    url: absoluteUrl("/"),
    publisher: {
      "@id": absoluteUrl(BUSINESS_REFERENCE_ID),
    },
  };
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbJsonLdItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildArticleJsonLd({
  title,
  description,
  path,
  image,
  datePublished,
  dateModified = datePublished,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished,
    dateModified,
    mainEntityOfPage: absoluteUrl(path),
    image: absoluteUrl(image ?? DEFAULT_OG_IMAGE),
    author: buildBusinessReferenceJsonLd(),
    publisher: buildBusinessReferenceJsonLd(),
  };
}
