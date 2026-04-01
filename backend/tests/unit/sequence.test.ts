import { generateSequenceNumber } from '@/utils/sequence';

// Mock the Prisma client
jest.mock('@/config/database', () => {
  return {
    __esModule: true,
    default: {
      gatePass: {
        findFirst: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
      },
      voucher: {
        findFirst: jest.fn(),
      },
    },
  };
});

import prisma from '@/config/database';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('generateSequenceNumber', () => {
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('gatePass model', () => {
    it('generates first gate pass number of the year', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('GP', 'gatePass');
      expect(result).toBe(`GP-${currentYear}-00001`);
    });

    it('increments from the last gate pass number', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue({
        gatePassNumber: `GP-${currentYear}-00042`,
      });

      const result = await generateSequenceNumber('GP', 'gatePass');
      expect(result).toBe(`GP-${currentYear}-00043`);
    });

    it('pads sequence to 5 digits', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue({
        gatePassNumber: `GP-${currentYear}-00009`,
      });

      const result = await generateSequenceNumber('GP', 'gatePass');
      expect(result).toBe(`GP-${currentYear}-00010`);
    });
  });

  describe('order model', () => {
    it('generates first order number of the year', async () => {
      (mockedPrisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('ORD', 'order');
      expect(result).toBe(`ORD-${currentYear}-00001`);
    });

    it('increments from the last order number', async () => {
      (mockedPrisma.order.findFirst as jest.Mock).mockResolvedValue({
        orderNumber: `ORD-${currentYear}-00100`,
      });

      const result = await generateSequenceNumber('ORD', 'order');
      expect(result).toBe(`ORD-${currentYear}-00101`);
    });
  });

  describe('voucher model', () => {
    it('generates first voucher number of the year', async () => {
      (mockedPrisma.voucher.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('VCH', 'voucher');
      expect(result).toBe(`VCH-${currentYear}-00001`);
    });

    it('increments from the last voucher number', async () => {
      (mockedPrisma.voucher.findFirst as jest.Mock).mockResolvedValue({
        voucherNumber: `VCH-${currentYear}-00500`,
      });

      const result = await generateSequenceNumber('VCH', 'voucher');
      expect(result).toBe(`VCH-${currentYear}-00501`);
    });
  });

  describe('format validation', () => {
    it('uses PREFIX-YYYY-NNNNN format', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('GP', 'gatePass');
      expect(result).toMatch(/^GP-\d{4}-\d{5}$/);
    });

    it('uses the current year', async () => {
      (mockedPrisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('ORD', 'order');
      expect(result).toContain(`-${currentYear}-`);
    });

    it('supports different prefixes', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await generateSequenceNumber('CUSTOM', 'gatePass');
      expect(result).toMatch(/^CUSTOM-\d{4}-00001$/);
    });

    it('handles high sequence numbers', async () => {
      (mockedPrisma.gatePass.findFirst as jest.Mock).mockResolvedValue({
        gatePassNumber: `GP-${currentYear}-99999`,
      });

      const result = await generateSequenceNumber('GP', 'gatePass');
      expect(result).toBe(`GP-${currentYear}-100000`);
    });
  });
});
