import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  organizationId: string | null;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with a tenant context available to every downstream async call
 * (Express middleware → controller → service → Prisma), via Node's
 * AsyncLocalStorage. See middleware/auth.middleware.ts for where this gets
 * populated from the JWT, and config/database.ts for the Prisma Client
 * Extension that reads it.
 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Returns the tenant context if this request has one at all, or `undefined`
 * if it doesn't (backoffice/platform-admin requests, which never call
 * runWithTenant, or public unauthenticated requests) — those are genuinely
 * unrestricted (a platform admin listing all organizations, for instance).
 *
 * This is deliberately NOT the same as `{ organizationId: null }`, which
 * means "this is a tenant request, and that tenant is the legacy/
 * pre-multi-tenancy org" — that case must still be scoped to
 * organizationId IS NULL, excluding every other tenant's rows. Collapsing
 * these two cases into a single "null means unrestricted" was a real bug
 * in the first version of this extension: it let the legacy tenant read
 * (and, via create, silently annex) every other tenant's data. See
 * config/database.ts for how each case is handled.
 */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Convenience wrapper for call sites that always want a definite value to
 * filter by (e.g. building an explicit `{ organizationId }` where clause
 * themselves) and don't need to distinguish "no context" from "legacy
 * tenant" — both collapse to `null` here. The Prisma extension in
 * database.ts does NOT use this; it needs the distinction and calls
 * getTenantContext() directly.
 */
export function getCurrentOrganizationId(): string | null {
  return storage.getStore()?.organizationId ?? null;
}
