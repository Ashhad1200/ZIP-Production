/**
 * Monthly Overhead Service
 *
 * Stores and retrieves monthly overhead costs (labor, rent, transportation,
 * packing, miscellaneous). These are distributed across all meters produced
 * in the same month to compute cost-per-meter overhead allocation.
 */

import prisma from '../config/database';
import { formatPaisaToRupees } from '../utils/currency';

export interface MonthlyOverheadInput {
  year: number;
  month: number; // 1–12
  laborPaisa?: bigint | number;
  rentPaisa?: bigint | number;
  transportationPaisa?: bigint | number;
  packingPaisa?: bigint | number;
  miscellaneousPaisa?: bigint | number;
  notes?: string;
}

export interface MonthlyOverheadDisplay {
  id: string;
  year: number;
  month: number;
  monthLabel: string;
  laborPaisa: string;
  rentPaisa: string;
  transportationPaisa: string;
  packingPaisa: string;
  miscellaneousPaisa: string;
  totalPaisa: string;
  laborDisplay: string;
  rentDisplay: string;
  transportationDisplay: string;
  packingDisplay: string;
  miscellaneousDisplay: string;
  totalDisplay: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDisplay(record: {
  id: string;
  year: number;
  month: number;
  laborPaisa: bigint;
  rentPaisa: bigint;
  transportationPaisa: bigint;
  packingPaisa: bigint;
  miscellaneousPaisa: bigint;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MonthlyOverheadDisplay {
  const total =
    record.laborPaisa +
    record.rentPaisa +
    record.transportationPaisa +
    record.packingPaisa +
    record.miscellaneousPaisa;

  return {
    id: record.id,
    year: record.year,
    month: record.month,
    monthLabel: `${MONTH_NAMES[record.month]} ${record.year}`,
    laborPaisa: record.laborPaisa.toString(),
    rentPaisa: record.rentPaisa.toString(),
    transportationPaisa: record.transportationPaisa.toString(),
    packingPaisa: record.packingPaisa.toString(),
    miscellaneousPaisa: record.miscellaneousPaisa.toString(),
    totalPaisa: total.toString(),
    laborDisplay: formatPaisaToRupees(record.laborPaisa),
    rentDisplay: formatPaisaToRupees(record.rentPaisa),
    transportationDisplay: formatPaisaToRupees(record.transportationPaisa),
    packingDisplay: formatPaisaToRupees(record.packingPaisa),
    miscellaneousDisplay: formatPaisaToRupees(record.miscellaneousPaisa),
    totalDisplay: formatPaisaToRupees(total),
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class MonthlyOverheadService {
  /** Upsert overheads for a given month/year */
  async upsert(input: MonthlyOverheadInput): Promise<MonthlyOverheadDisplay> {
    const data = {
      laborPaisa: BigInt(input.laborPaisa ?? 0),
      rentPaisa: BigInt(input.rentPaisa ?? 0),
      transportationPaisa: BigInt(input.transportationPaisa ?? 0),
      packingPaisa: BigInt(input.packingPaisa ?? 0),
      miscellaneousPaisa: BigInt(input.miscellaneousPaisa ?? 0),
      notes: input.notes ?? null,
    };

    const record = await prisma.monthlyOverhead.upsert({
      where: { year_month: { year: input.year, month: input.month } },
      update: data,
      create: { year: input.year, month: input.month, ...data },
    });

    return toDisplay(record);
  }

  /** Get overhead record for a specific month/year */
  async getForMonth(year: number, month: number): Promise<MonthlyOverheadDisplay | null> {
    const record = await prisma.monthlyOverhead.findUnique({
      where: { year_month: { year, month } },
    });
    return record ? toDisplay(record) : null;
  }

  /** Get raw BigInt totals for a month (for cost calculation) */
  async getTotalPaisaForMonth(year: number, month: number): Promise<bigint> {
    const record = await prisma.monthlyOverhead.findUnique({
      where: { year_month: { year, month } },
    });
    if (!record) return 0n;
    return (
      record.laborPaisa +
      record.rentPaisa +
      record.transportationPaisa +
      record.packingPaisa +
      record.miscellaneousPaisa
    );
  }

  /** Get raw breakdown for a month (for cost calculation) */
  async getBreakdownForMonth(year: number, month: number) {
    const record = await prisma.monthlyOverhead.findUnique({
      where: { year_month: { year, month } },
    });
    if (!record) {
      return {
        laborPaisa: 0n,
        rentPaisa: 0n,
        transportationPaisa: 0n,
        packingPaisa: 0n,
        miscellaneousPaisa: 0n,
        totalPaisa: 0n,
      };
    }
    const totalPaisa =
      record.laborPaisa +
      record.rentPaisa +
      record.transportationPaisa +
      record.packingPaisa +
      record.miscellaneousPaisa;
    return {
      laborPaisa: record.laborPaisa,
      rentPaisa: record.rentPaisa,
      transportationPaisa: record.transportationPaisa,
      packingPaisa: record.packingPaisa,
      miscellaneousPaisa: record.miscellaneousPaisa,
      totalPaisa,
    };
  }

  /** List all overhead records, newest first */
  async list(params: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 24 } = params;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.monthlyOverhead.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.monthlyOverhead.count(),
    ]);

    return {
      data: records.map(toDisplay),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Delete a record */
  async delete(id: string) {
    await prisma.monthlyOverhead.delete({ where: { id } });
  }
}

export const monthlyOverheadService = new MonthlyOverheadService();
