import type { MetadataRoute } from "next";
import { listArticles } from "@/lib/articles";
import { listCrmProjects } from "@/lib/crmProjects.server";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import { absoluteUrl } from "@/lib/seo";

const ACCESSIBILITY_LAST_MODIFIED = "2026-07-27";

export const revalidate = 3600;

function sitemapEntry(
  pathname: string,
  lastModified?: string
): MetadataRoute.Sitemap[number] {
  const parsedLastModified =
    lastModified === undefined ? undefined : new Date(lastModified);

  if (
    parsedLastModified === undefined ||
    Number.isNaN(parsedLastModified.getTime())
  ) {
    return { url: absoluteUrl(pathname) };
  }

  return { url: absoluteUrl(pathname), lastModified: parsedLastModified };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [crmProjects, serviceAreas, articles] = await Promise.all([
    listCrmProjects(),
    listResolvedServiceAreas(),
    listArticles(),
  ]);
  const citiesWithProjects = new Set(
    crmProjects.map((project) => project.citySlug)
  );
  const indexableServiceAreas = serviceAreas.filter(
    (area) => area.curated || citiesWithProjects.has(area.slug)
  );
  const serviceAreaDirectoryLastModified = serviceAreas
    .map((area) => area.lastModified)
    .toSorted()
    .at(-1);
  const staticRoutes: MetadataRoute.Sitemap = [
    sitemapEntry("/"),
    sitemapEntry("/buildings"),
    sitemapEntry("/gallery"),
    sitemapEntry("/quote"),
    sitemapEntry("/contact"),
    sitemapEntry("/accessibility", ACCESSIBILITY_LAST_MODIFIED),
    sitemapEntry("/privacy-policy"),
    sitemapEntry("/terms-and-conditions"),
    sitemapEntry("/news"),
    sitemapEntry("/service-area", serviceAreaDirectoryLastModified),
    ...indexableServiceAreas.map((area) =>
      sitemapEntry(`/service-area/${area.slug}`, area.lastModified)
    ),
  ];

  const projectRoutes: MetadataRoute.Sitemap = crmProjects.map((project) =>
    sitemapEntry(`/projects/${project.citySlug}/${project.slug}`)
  );
  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) =>
    sitemapEntry(`/news/${article.slug}`, article.modifiedDate || article.date)
  );

  return [...staticRoutes, ...projectRoutes, ...articleRoutes];
}
