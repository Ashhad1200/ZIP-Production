import prisma from '../../config/database';

export interface BankAccountInput {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban?: string;
  branchCode?: string;
  sortOrder?: number;
}

export class BankAccountService {
  async listActive() {
    return prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async listAll() {
    return prisma.bankAccount.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(input: BankAccountInput) {
    return prisma.bankAccount.create({ data: input });
  }

  async setActive(id: string, isActive: boolean) {
    return prisma.bankAccount.update({ where: { id }, data: { isActive } });
  }
}

export const bankAccountService = new BankAccountService();
