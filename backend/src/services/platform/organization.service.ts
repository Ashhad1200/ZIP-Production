import prisma from '../../config/database';
import { recomputeSubscriptionStatus } from './subscription.service';
import { hashPassword } from '../../utils/password';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface SignupInput {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  industry?: string;
  adminUserName: string;
  password: string;
  planCode: string;
}

export class OrganizationService {
  /**
   * Public self-serve signup: creates the Organization, its first tenant
   * User (SUPER_ADMIN, with a real email+password login), and a TRIAL
   * Subscription against the chosen Plan.
   */
  async signup(input: SignupInput) {
    const plan = await prisma.plan.findUnique({ where: { code: input.planCode, isActive: true } });
    if (!plan) {
      throw Object.assign(new Error('Selected plan is not available'), { statusCode: 422, code: 'INVALID_PLAN' });
    }

    const existingEmail = await prisma.organization.findUnique({ where: { contactEmail: input.contactEmail } });
    if (existingEmail) {
      throw Object.assign(new Error('An organization with this email already exists'), {
        statusCode: 409,
        code: 'EMAIL_TAKEN',
      });
    }

    const existingUserEmail = await prisma.user.findUnique({ where: { email: input.contactEmail } });
    if (existingUserEmail) {
      throw Object.assign(new Error('An account with this email already exists'), {
        statusCode: 409,
        code: 'EMAIL_TAKEN',
      });
    }

    const baseSlug = slugify(input.organizationName) || 'organization';
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          industry: input.industry,
          status: 'TRIAL',
          trialEndsAt,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          name: input.adminUserName,
          email: input.contactEmail,
          passwordHash: hashPassword(input.password),
          role: 'SUPER_ADMIN',
          organizationId: organization.id,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: 'TRIAL',
          trialEndsAt,
        },
      });

      return { organization, adminUser, subscription, plan };
    });
  }

  async list() {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        _count: { select: { companies: true, users: true } },
      },
    });
  }

  async getById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: { orderBy: { createdAt: 'desc' }, include: { plan: { include: { planModules: { include: { module: true } } } } } },
        payments: { orderBy: { submittedAt: 'desc' } },
        companies: true,
        users: { select: { id: true, name: true, role: true, isActive: true, createdAt: true } },
      },
    });
    if (!organization) {
      throw Object.assign(new Error('Organization not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    return organization;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELED') {
    return prisma.organization.update({ where: { id }, data: { status } });
  }

  async getOrganizationIdForUser(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    return user?.organizationId ?? null;
  }

  /**
   * Tenant-facing subscription status (for the "Payment Required" / billing
   * screen — see frontend/src/pages/Billing). Recomputes TRIAL/ACTIVE ->
   * PAST_DUE lazily (no cron dependency) before returning, same as the
   * backoffice dashboard summary.
   */
  async getMySubscription(userId: string) {
    const organizationId = await this.getOrganizationIdForUser(userId);
    if (!organizationId) {
      // Legacy/default tenant (pre-multi-tenancy user) — no subscription to report.
      return null;
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!subscription) return null;

    const refreshed = await recomputeSubscriptionStatus(subscription.id);
    return { ...subscription, status: refreshed?.status ?? subscription.status };
  }

  /**
   * Enforce Plan.maxSubCompanies against an Organization's active Subscription.
   * Exposed for the tenant-side Company-creation endpoint to call once wired
   * (see specs/002-saas-platform/tasks.md T014+).
   */
  async assertCanCreateSubCompany(organizationId: string): Promise<void> {
    const [subscription, companyCount] = await Promise.all([
      prisma.subscription.findFirst({
        where: { organizationId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      }),
      prisma.company.count({ where: { organizationId, isDeleted: false } }),
    ]);

    if (!subscription) {
      throw Object.assign(new Error('No active subscription'), { statusCode: 403, code: 'NO_SUBSCRIPTION' });
    }
    if (companyCount >= subscription.plan.maxSubCompanies) {
      throw Object.assign(
        new Error(`Your plan allows a maximum of ${subscription.plan.maxSubCompanies} sub-companies`),
        { statusCode: 403, code: 'SUB_COMPANY_LIMIT_REACHED' }
      );
    }
  }
}

export const organizationService = new OrganizationService();
