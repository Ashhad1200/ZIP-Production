import prisma from '../../config/database';

export interface PlanInput {
  name: string;
  code: string;
  pricePaisa: bigint;
  billingCycleDays?: number;
  trialDays?: number;
  maxSubCompanies?: number;
  maxUsers?: number | null;
  sortOrder?: number;
  moduleKeys: string[];
}

export class PlanService {
  async list() {
    return prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { planModules: { include: { module: true } } },
    });
  }

  async getById(id: string) {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { planModules: { include: { module: true } } },
    });
    if (!plan) {
      throw Object.assign(new Error('Plan not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    return plan;
  }

  async create(input: PlanInput) {
    return prisma.$transaction(async (tx) => {
      const plan = await tx.plan.create({
        data: {
          name: input.name,
          code: input.code,
          pricePaisa: input.pricePaisa,
          billingCycleDays: input.billingCycleDays ?? 30,
          trialDays: input.trialDays ?? 3,
          maxSubCompanies: input.maxSubCompanies ?? 1,
          maxUsers: input.maxUsers ?? null,
          sortOrder: input.sortOrder ?? 0,
        },
      });

      if (input.moduleKeys.length > 0) {
        const modules = await tx.module.findMany({ where: { key: { in: input.moduleKeys } } });
        await tx.planModule.createMany({
          data: modules.map((m) => ({ planId: plan.id, moduleId: m.id })),
        });
      }

      return tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { planModules: { include: { module: true } } },
      });
    });
  }

  async update(id: string, input: Partial<PlanInput>) {
    return prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id },
        data: {
          name: input.name,
          code: input.code,
          pricePaisa: input.pricePaisa,
          billingCycleDays: input.billingCycleDays,
          trialDays: input.trialDays,
          maxSubCompanies: input.maxSubCompanies,
          maxUsers: input.maxUsers,
          sortOrder: input.sortOrder,
        },
      });

      if (input.moduleKeys) {
        await tx.planModule.deleteMany({ where: { planId: id } });
        const modules = await tx.module.findMany({ where: { key: { in: input.moduleKeys } } });
        await tx.planModule.createMany({
          data: modules.map((m) => ({ planId: id, moduleId: m.id })),
        });
      }

      return tx.plan.findUniqueOrThrow({
        where: { id },
        include: { planModules: { include: { module: true } } },
      });
    });
  }

  async setActive(id: string, isActive: boolean) {
    return prisma.plan.update({ where: { id }, data: { isActive } });
  }
}

export const planService = new PlanService();
