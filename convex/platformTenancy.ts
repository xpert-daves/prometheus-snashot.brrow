import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type TenantCtx = QueryCtx | MutationCtx;
type TenantScopedDoc = { tenantId?: Id<"tenants"> };
type ActiveTenantContext = {
  tenantId: Id<"tenants"> | null;
  tenantSlug: string;
  allowLegacyUnscoped: boolean;
};

export const SHED210_TENANT_NAME = "Shed210";
export const SHED210_TENANT_SLUG = "shed210";
export const SHED210_TENANT_VERTICAL = "shed_builder";
export const SHED210_TENANT_TIME_ZONE = "America/Chicago";

const activeTenantContexts = new WeakMap<object, ActiveTenantContext>();

function ctxKey(ctx: TenantCtx) {
  return ctx as unknown as object;
}

export function setActiveTenantContext(
  ctx: TenantCtx,
  context: ActiveTenantContext
) {
  activeTenantContexts.set(ctxKey(ctx), context);
}

export function getActiveTenantContext(ctx: TenantCtx) {
  return activeTenantContexts.get(ctxKey(ctx)) ?? null;
}

export function allowsLegacyUnscopedTenantRows(tenantSlug: string) {
  return tenantSlug === SHED210_TENANT_SLUG;
}

export function normalizeTenantSlug(value: string | null | undefined) {
  const slug = value?.trim().toLowerCase();
  return slug || SHED210_TENANT_SLUG;
}

export async function getTenantBySlug(
  ctx: TenantCtx,
  tenantSlug: string
): Promise<Doc<"tenants"> | null> {
  const tenants = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (query) =>
      query.eq("slug", normalizeTenantSlug(tenantSlug))
    )
    .take(2);

  return tenants[0] ?? null;
}

export async function setActiveTenantContextBySlug(
  ctx: TenantCtx,
  tenantSlug: string | null | undefined
) {
  const tenant = await getTenantBySlug(ctx, normalizeTenantSlug(tenantSlug));
  if (!tenant) throw new Error("Tenant not found");
  setActiveTenantContext(ctx, {
    tenantId: tenant._id,
    tenantSlug: tenant.slug,
    allowLegacyUnscoped: allowsLegacyUnscopedTenantRows(tenant.slug),
  });
  return tenant;
}

export async function setActiveTenantContextByTenantId(
  ctx: TenantCtx,
  tenantId: Id<"tenants"> | null | undefined
) {
  if (!tenantId) return null;
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  setActiveTenantContext(ctx, {
    tenantId: tenant._id,
    tenantSlug: tenant.slug,
    allowLegacyUnscoped: allowsLegacyUnscopedTenantRows(tenant.slug),
  });
  return tenant;
}

export async function getShed210Tenant(
  ctx: TenantCtx
): Promise<Doc<"tenants"> | null> {
  return await getTenantBySlug(ctx, SHED210_TENANT_SLUG);
}

export async function getShed210TenantIdOrNull(
  ctx: TenantCtx
): Promise<Id<"tenants"> | null> {
  return (await getShed210Tenant(ctx))?._id ?? null;
}

export async function getShed210TenantIdForExistingWrite(
  ctx: TenantCtx
): Promise<Id<"tenants"> | undefined> {
  const activeTenant = getActiveTenantContext(ctx);
  if (activeTenant?.tenantId) return activeTenant.tenantId;
  return (await getShed210Tenant(ctx))?._id;
}

export function belongsToShed210Tenant(
  doc: TenantScopedDoc,
  tenantId: Id<"tenants"> | null
) {
  if (doc.tenantId === undefined) return true;
  return tenantId !== null && doc.tenantId === tenantId;
}

export function belongsToActiveTenant(
  doc: TenantScopedDoc,
  context: ActiveTenantContext
) {
  if (doc.tenantId === undefined) return context.allowLegacyUnscoped;
  return context.tenantId !== null && doc.tenantId === context.tenantId;
}

export async function filterShed210TenantDocs<T extends TenantScopedDoc>(
  ctx: TenantCtx,
  docs: T[]
): Promise<T[]> {
  const activeTenant = getActiveTenantContext(ctx);
  if (activeTenant) {
    return docs.filter((doc) => belongsToActiveTenant(doc, activeTenant));
  }

  if (docs.every((doc) => doc.tenantId === undefined)) return docs;
  const tenantId = await getShed210TenantIdOrNull(ctx);
  return docs.filter((doc) => belongsToShed210Tenant(doc, tenantId));
}

export function tenantIdFields(
  tenantId: Id<"tenants"> | undefined
): { tenantId: Id<"tenants"> } {
  if (!tenantId) throw new Error("Tenant context is required");
  return { tenantId };
}
