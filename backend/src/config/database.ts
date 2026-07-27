import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getTenantContext } from './tenant-context';
import { TENANT_SCOPED_MODELS } from './tenant-scoped-models';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const SCOPED_WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/**
 * Tenant isolation, retrofitted via a Prisma Client Extension rather than
 * editing every service query individually (~15 services, 100+ call sites)
 * — see docs/SAAS-PLATFORM-BLUEPRINT.md Phase 2 for the rationale.
 *
 * Auto-scopes findMany/findFirst/count/aggregate/groupBy/updateMany/deleteMany
 * by the AsyncLocalStorage-held tenant context (see tenant-context.ts) for
 * every model in TENANT_SCOPED_MODELS, and stamps organizationId onto
 * create/createMany when the caller didn't set it explicitly.
 *
 * Two distinct cases, not one — this distinction matters and was a real bug
 * in an earlier version of this extension:
 *   - NO context at all (backoffice/platform-admin requests, which never call
 *     runWithTenant; public unauthenticated requests) → genuinely
 *     unrestricted, e.g. a platform admin listing every organization.
 *   - Context present with organizationId = null (a tenant-authenticated
 *     request from the legacy/pre-multi-tenancy org, before Phase 2's
 *     backfill runs) → still scoped, to `organizationId IS NULL`
 *     specifically. Treating this as "unrestricted" would let the legacy
 *     tenant read (and, via create, silently annex) every other tenant's
 *     rows — this was caught live via a manual cross-tenant test.
 *
 * KNOWN GAP: findUnique/findUniqueOrThrow/update/delete/upsert take a
 * unique-only `where` (id, or a declared @@unique compound) — Prisma
 * rejects extra filter fields on that shape at runtime, so this extension
 * cannot auto-inject organizationId into single-record-by-id operations.
 * Those call sites still rely on the id itself (a non-enumerable UUID)
 * being sourced from an already-scoped query or the caller's own session.
 * Follow-up: convert tenant-critical findUnique-by-id calls to
 * findFirst({ where: { id, organizationId } }) at the service layer —
 * tracked in specs/002-saas-platform/tasks.md.
 */
const prisma = basePrisma.$extends({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const ctx = getTenantContext();
        if (ctx === undefined) {
          // No tenant context at all — not a tenant request. Unrestricted.
          return query(args);
        }
        const organizationId = ctx.organizationId; // string | null — both are real filter values now

        const a = args as Record<string, unknown>;

        if (SCOPED_WHERE_OPS.has(operation)) {
          a.where = { AND: [a.where ?? {}, { organizationId }] };
        } else if (operation === 'create') {
          const data = a.data as Record<string, unknown> | undefined;
          if (data && data.organizationId === undefined) {
            data.organizationId = organizationId;
          }
        } else if (operation === 'upsert') {
          // where/update are unique-keyed and left untouched (see KNOWN GAP above);
          // only the create branch is safe and useful to stamp.
          const create = a.create as Record<string, unknown> | undefined;
          if (create && create.organizationId === undefined) {
            create.organizationId = organizationId;
          }
        } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
          const data = a.data;
          if (Array.isArray(data)) {
            for (const row of data as Record<string, unknown>[]) {
              if (row.organizationId === undefined) row.organizationId = organizationId;
            }
          }
        }

        return query(a);
      },
    },
  },
});

export default prisma;

/**
 * Type of the tenant-scoped extended client. Service code that used to
 * type transaction helpers as `Prisma.TransactionClient` must use this
 * instead — comparing the extended client's generics against the base
 * `Prisma.TransactionClient` type causes a TS "excessive stack depth"
 * error, a known rough edge of Prisma Client Extensions. Deriving the type
 * from this same extended client (rather than the base `Prisma` namespace)
 * avoids that cross-comparison entirely.
 */
export type TenantPrismaClient = typeof prisma;
// Same shape Prisma's own generated `Prisma.TransactionClient` uses
// (the full client minus the top-level lifecycle/extension methods that
// aren't available inside a `$transaction(async (tx) => ...)` callback) —
// applied to our extended client type instead of the base one.
export type TenantTransactionClient = Omit<TenantPrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
