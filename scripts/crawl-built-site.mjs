#!/usr/bin/env node

import process from "node:process";

const PRIORITY_PATHS = [
  "/service-area/san-antonio",
  "/service-area/universal-city",
  "/service-area",
  "/gallery",
  "/news",
  "/news/san-antonio-shed-cost-guide",
  "/news/sanantonio_shed_guide",
];

const GENERIC_ANCHOR_TEXT = new Set([
  "click here",
  "continue",
  "details",
  "go",
  "here",
  "learn more",
  "link",
  "more",
  "open",
  "read more",
  "see more",
  "view more",
]);

const ASSET_EXTENSION_RE =
  /\.(?:avif|bmp|css|csv|eot|gif|ico|jpe?g|js|json|map|mjs|mov|mp3|mp4|ogg|otf|pdf|png|svg|tiff?|ttf|txt|wav|webm|webmanifest|webp|woff2?|xml|zip)$/i;
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.SITE_CRAWL_TIMEOUT_MS || "15000", 10);
const MAX_PAGES = Number.parseInt(process.env.SITE_CRAWL_MAX_PAGES || "500", 10);
const INDEXING_ONLY = process.argv.includes('--indexing-only');

function readBaseUrl() {
  const args = process.argv.slice(2);
  const namedIndex = args.indexOf("--base-url");
  const namedValue = namedIndex >= 0 ? args[namedIndex + 1] : undefined;
  const inlineValue = args.find((arg) => arg.startsWith("--base-url="))?.slice(11);
  const positionalValue = args.find((arg) => !arg.startsWith("--"));
  const raw =
    namedValue ||
    inlineValue ||
    positionalValue ||
    process.env.SITE_CRAWL_BASE_URL ||
    "http://localhost:3000";

  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error(`Base URL must use http or https: ${raw}`);
  }
  return new URL("/", url);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractAttribute(tag, name) {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i"
  );
  const match = pattern.exec(tag);
  return match ? decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function normalizePathname(pathname) {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function normalizeUrl(value, sourceUrl, origin) {
  if (!value || /^(?:data|blob|mailto|sms|tel|javascript):/i.test(value.trim())) return null;

  try {
    const url = new URL(value, sourceUrl);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function stripMarkup(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isDescriptiveAnchor(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[\u2190-\u21ff]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized.length >= 3 &&
    !GENERIC_ANCHOR_TEXT.has(normalized) &&
    !/^https?\b/.test(normalized)
  );
}

function extractAnchors(html) {
  const anchors = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const openTag = match[1];
    const href = extractAttribute(openTag, "href");
    if (!href) continue;
    const label = extractAttribute(openTag, "aria-label") || stripMarkup(match[2]);
    anchors.push({ href, label });
  }

  return anchors;
}

function extractSrcset(value) {
  if (!value || value.trim().startsWith("data:")) return [];
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractCssUrls(css) {
  const urls = [];
  const pattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/gi;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    urls.push(match[1] ?? match[2] ?? match[3]);
  }
  return urls;
}

function extractAssetUrls(html, sourceUrl, origin) {
  const assets = new Set();
  const add = (value) => {
    const url = normalizeUrl(value, sourceUrl, origin);
    if (url) assets.add(url.href);
  };

  const tagPattern = /<(img|script|source|video|audio|iframe|embed|object|input)\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];
    const primaryAttribute = tagName === "object" ? "data" : "src";
    add(extractAttribute(tag, primaryAttribute));
    if (tagName === "video") add(extractAttribute(tag, "poster"));
    for (const candidate of extractSrcset(extractAttribute(tag, "srcset"))) add(candidate);
  }

  const linkPattern = /<link\b[^>]*>/gi;
  while ((match = linkPattern.exec(html)) !== null) {
    const tag = match[0];
    const rel = (extractAttribute(tag, "rel") || "").toLowerCase();
    if (/\b(?:stylesheet|icon|preload|modulepreload|manifest)\b/.test(rel)) {
      add(extractAttribute(tag, "href"));
      for (const candidate of extractSrcset(extractAttribute(tag, "imagesrcset"))) add(candidate);
    }
  }

  const metaPattern = /<meta\b[^>]*>/gi;
  while ((match = metaPattern.exec(html)) !== null) {
    const tag = match[0];
    const key = (extractAttribute(tag, "property") || extractAttribute(tag, "name") || "")
      .toLowerCase()
      .trim();
    if (["og:image", "twitter:image", "msapplication-tileimage"].includes(key)) {
      add(extractAttribute(tag, "content"));
    }
  }

  for (const cssUrl of extractCssUrls(html)) add(cssUrl);
  return assets;
}

function looksLikeAsset(url) {
  return ASSET_EXTENSION_RE.test(url.pathname);
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    redirect: "follow",
    ...options,
    headers: {
      "user-agent": "Shed210LocalCrawler/1.0",
      ...options.headers,
    },
    // Keep the deadline active while the response body is being consumed.
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function crawl() {
  const baseUrl = readBaseUrl();
  const origin = baseUrl.origin;
  const pageQueue = [{ url: baseUrl, depth: 0 }];
  const queuedPages = new Set([baseUrl.href]);
  const crawledPages = new Set();
  const assetUrls = new Set();
  const depthByPath = new Map([["/", 0]]);
  const inlinksByPriorityPath = new Map(PRIORITY_PATHS.map((path) => [path, new Map()]));
  const failures = [];
  const sitemapResponse = await fetchWithTimeout(new URL('/sitemap.xml', baseUrl));
  if (!sitemapResponse.ok) throw new Error(`Sitemap returned ${sitemapResponse.status}`);
  const sitemapXml = await sitemapResponse.text();
  const sitemapUrls = [...sitemapXml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)]
    .map((match) => new URL(decodeHtmlEntities(match[1].trim())));
  if (sitemapUrls.length === 0) throw new Error('Sitemap contains no page URLs');
  const sitemapByPath = new Map();
  for (const url of sitemapUrls) {
    if (url.protocol !== 'https:' || url.search || url.hash || looksLikeAsset(url)) {
      failures.push(`Sitemap contains a noncanonical page URL: ${url.href}`);
    }
    if (sitemapByPath.has(url.pathname)) failures.push(`Duplicate sitemap path: ${url.pathname}`);
    sitemapByPath.set(url.pathname, url);
  }
  const validatedSitemapPaths = new Set();

  for (let index = 0; index < pageQueue.length; index += 1) {
    if (crawledPages.size >= MAX_PAGES) {
      failures.push(`Stopped after ${MAX_PAGES} pages; raise SITE_CRAWL_MAX_PAGES if intentional.`);
      break;
    }

    const { url, depth } = pageQueue[index];
    if (crawledPages.has(url.href)) continue;
    crawledPages.add(url.href);
    if (crawledPages.size % 10 === 0) console.log(`Checking page ${crawledPages.size}: ${url.pathname}`);

    let response;
    try {
      response = await fetchWithTimeout(url);
    } catch (error) {
      failures.push(`Page request failed: ${url.href} (${error.message})`);
      continue;
    }

    if (!response.ok) {
      failures.push(`Page returned ${response.status}: ${url.href}`);
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) continue;

    const html = await response.text();
    const responseUrl = new URL(response.url);
    const sourcePath = normalizePathname(responseUrl.pathname);
    // Compare against the published canonical URL even when crawling a local build.
    const sitemapUrl = sitemapByPath.get(url.pathname);
    if (sitemapUrl && !url.search) {
      validatedSitemapPaths.add(url.pathname);
      if (response.redirected) failures.push(`Sitemap page redirects: ${url.pathname}`);
      const canonicalTags = [...html.matchAll(/<link\b[^>]*>/gi)]
        .map((match) => match[0])
        .filter((tag) => extractAttribute(tag, 'rel') === 'canonical');
      const canonical = canonicalTags.length === 1
        ? extractAttribute(canonicalTags[0], 'href') : null;
      if (!canonical || new URL(canonical, sitemapUrl).href !== sitemapUrl.href) {
        failures.push(`Sitemap page has missing, duplicate, or mismatched canonical: ${url.pathname}`);
      }
      for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
        const name = extractAttribute(tag, 'name')?.toLowerCase();
        if (['robots', 'googlebot'].includes(name) &&
            /\b(?:noindex|none)\b/i.test(extractAttribute(tag, 'content') ?? '')) {
          failures.push(`Sitemap page has a noindex directive: ${url.pathname}`);
        }
      }
    }
    const currentDepth = depthByPath.get(sourcePath);
    depthByPath.set(sourcePath, currentDepth === undefined ? depth : Math.min(currentDepth, depth));

    if (!INDEXING_ONLY) {
      for (const assetUrl of extractAssetUrls(html, responseUrl, origin)) assetUrls.add(assetUrl);
    }

    for (const anchor of extractAnchors(html)) {
      const targetUrl = normalizeUrl(anchor.href, responseUrl, origin);
      if (!targetUrl) continue;
      if (INDEXING_ONLY && (targetUrl.search || !sitemapByPath.has(targetUrl.pathname))) continue;

      const targetPath = normalizePathname(targetUrl.pathname);
      if (
        targetPath !== sourcePath &&
        inlinksByPriorityPath.has(targetPath) &&
        isDescriptiveAnchor(anchor.label)
      ) {
        const sourceInlinks = inlinksByPriorityPath.get(targetPath);
        const labels = sourceInlinks.get(sourcePath) || new Set();
        labels.add(anchor.label);
        sourceInlinks.set(sourcePath, labels);
      }

      if (looksLikeAsset(targetUrl)) {
        assetUrls.add(targetUrl.href);
        continue;
      }

      const nextDepth = depth + 1;
      const knownDepth = depthByPath.get(targetPath);
      if (knownDepth === undefined || nextDepth < knownDepth) depthByPath.set(targetPath, nextDepth);
      if (!queuedPages.has(targetUrl.href)) {
        queuedPages.add(targetUrl.href);
        pageQueue.push({ url: targetUrl, depth: nextDepth });
      }
    }
  }

  for (const [path] of sitemapByPath) {
    if (!validatedSitemapPaths.has(path)) {
      failures.push(`Sitemap page was not reached as a successful HTML page from /: ${path}`);
    }
    const depth = depthByPath.get(path);
    if (depth !== undefined && depth > 2) {
      failures.push(`Sitemap page exceeds two clicks from /: ${path} (${depth})`);
    }
  }

  const checkedAssets = new Set();
  const assetQueue = [...assetUrls];
  for (let index = 0; index < assetQueue.length; index += 1) {
    const assetUrl = assetQueue[index];
    if (checkedAssets.has(assetUrl)) continue;
    checkedAssets.add(assetUrl);

    let response;
    try {
      response = await fetchWithTimeout(assetUrl, { method: "HEAD" });
      if (!response.ok) {
        response = await fetchWithTimeout(assetUrl, {
          headers: { range: "bytes=0-0" },
        });
      }
    } catch (error) {
      failures.push(`Asset request failed: ${assetUrl} (${error.message})`);
      continue;
    }

    if (!response.ok) {
      failures.push(`Asset returned ${response.status}: ${assetUrl}`);
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/css")) {
      const cssResponse = await fetchWithTimeout(assetUrl);
      if (!cssResponse.ok) {
        failures.push(`Stylesheet returned ${cssResponse.status}: ${assetUrl}`);
        continue;
      }
      const css = await cssResponse.text();
      for (const value of extractCssUrls(css)) {
        const nested = normalizeUrl(value, assetUrl, origin);
        if (nested && !checkedAssets.has(nested.href)) assetQueue.push(nested.href);
      }
    }
  }

  console.log(`Crawled ${crawledPages.size} page URL(s) from ${baseUrl.href}`);
  console.log(INDEXING_ONLY ? 'Indexing-only mode: asset and filtered-gallery checks skipped' : `Checked ${checkedAssets.size} same-origin asset URL(s)`);
  console.log(`Validated ${validatedSitemapPaths.size}/${sitemapUrls.length} sitemap pages for reachability, canonical tags, and indexability`);
  console.log("Priority URL checks:");

  for (const path of PRIORITY_PATHS) {
    const depth = depthByPath.get(path);
    const sourceInlinks = inlinksByPriorityPath.get(path);
    const sourceCount = sourceInlinks.size;
    const sources = [...sourceInlinks.keys()].sort();
    console.log(
      `- ${path}: depth=${depth ?? "unreachable"}, descriptive source-page inlinks=${sourceCount}` +
        (sources.length ? ` (${sources.join(", ")})` : "")
    );

    if (depth === undefined) failures.push(`Priority page is unreachable from /: ${path}`);
    else if (depth > 2) failures.push(`Priority page exceeds two clicks from /: ${path} (${depth})`);
    if (sourceCount < 3) {
      failures.push(`Priority page has fewer than three descriptive source-page inlinks: ${path} (${sourceCount})`);
    }
  }

  if (failures.length) {
    console.error("\nCrawl validation failed:");
    for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nCrawl validation passed.");
}

crawl().catch((error) => {
  console.error(`Crawl validation could not run: ${error.message}`);
  process.exitCode = 1;
});
