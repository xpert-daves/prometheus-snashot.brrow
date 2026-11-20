import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CRM_PROJECTS_TENANT_SLUG } from "@/lib/projectsConfig";
import {
  isJsonRequestContentType,
  QuoteRequestBodyTooLargeError,
  readJsonRequestBody,
} from "@/lib/quoteRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const projectPath = z.string().max(332).regex(
  /^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
).refine((path) => {
  const [, , city, slug] = path.split("/");
  return typeof city === "string" && typeof slug === "string" &&
    city.length <= 80 && slug.length <= 240;
});

const commonFields = {
  version: z.literal(1),
  tenantSlug: z.literal(CRM_PROJECTS_TENANT_SLUG),
};

const eventSchema = z.discriminatedUnion("kind", [
  z.object({
    ...commonFields,
    kind: z.literal("projects"),
    projectPaths: z.array(projectPath).min(1).max(50),
  }).strict(),
  z.object({ ...commonFields, kind: z.literal("cities") }).strict(),
]);

function hasValidAuthorization(request: NextRequest, secret: string): boolean {
  const supplied = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!supplied) return false;
  // Hash first so comparison time does not reveal the configured secret length.
  return timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(secret).digest(),
  );
}

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SHED210_SITE_REVALIDATION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return respond({ error: "Revalidation is not configured" }, 503);
  }
  if (!hasValidAuthorization(request, secret)) {
    return respond({ error: "Unauthorized" }, 401);
  }
  if (!isJsonRequestContentType(request.headers.get("content-type"))) {
    return respond({ error: "Expected JSON" }, 415);
  }

  let body: unknown;
  try {
    body = await readJsonRequestBody(request, 32_768);
  } catch (error) {
    return respond(
      { error: error instanceof QuoteRequestBodyTooLargeError ? "Request too large" : "Invalid JSON" },
      error instanceof QuoteRequestBodyTooLargeError ? 413 : 400,
    );
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return respond({ error: "Invalid revalidation event" }, 400);

  try {
    // In a Route Handler these mark pages stale for their next visit. They do
    // not eagerly regenerate the whole site or invalidate unrelated layouts.
    for (const path of ["/", "/buildings", "/gallery", "/service-area", "/sitemap.xml"]) {
      revalidatePath(path);
    }
    revalidatePath("/service-area/[city]", "page");

    if (parsed.data.kind === "cities") {
      revalidatePath("/contact");
      revalidatePath("/projects/[citySlug]/[slug]", "page");
    } else {
      for (const path of new Set(parsed.data.projectPaths)) revalidatePath(path);
    }
  } catch {
    // A retry may repeat some invalidations; the operation is idempotent.
    return respond({ error: "Revalidation failed" }, 503);
  }

  return respond({ revalidated: true });
}
