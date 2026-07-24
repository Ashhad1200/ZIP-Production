import prisma from '../../config/database';

export class ModuleService {
  async list() {
    return prisma.module.findMany({ orderBy: { sortOrder: 'asc' } });
  }
}

export const moduleService = new ModuleService();
