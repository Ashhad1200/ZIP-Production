import prisma from '../config/database';
import { Shift, GatePassStatus, JournalEntryStatus } from '@prisma/client';
import { formatPaisaToRupees } from '../utils/currency';
import { toISODate } from '../utils/date';
import { TrendData } from '../types';

type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

function computeTrend(current: number, previous: number, comparedTo: string): TrendData {
  if (previous === 0 && current === 0) return { value: 0, direction: 'FLAT', comparedTo };
  if (previous === 0) return { value: 100, direction: 'UP', comparedTo };
  const pct = Math.round(((current - previous) / previous) * 100);
  let direction: TrendDirection = 'FLAT';
  if (pct > 0) direction = 'UP';
  else if (pct < 0) direction = 'DOWN';
  return { value: Math.abs(pct), direction, comparedTo };
}

function todayRange(): { gte: Date; lt: Date } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { gte: today, lt: tomorrow };
}

function dayRange(daysAgo: number): { gte: Date; lt: Date } {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - daysAgo);
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  return { gte: day, lt: next };
}

function periodToDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() + 1); // end of today
  const start = new Date(end);

  switch (period) {
    case '7d':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case '30d':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case '90d':
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    case '12m':
      start.setUTCMonth(start.getUTCMonth() - 12);
      break;
    default:
      start.setUTCDate(start.getUTCDate() - 7);
  }

  return { start, end };
}

export class DashboardService {
  // ─── KPIs ────────────────────────────────────────────────
  async getKPIs() {
    const today = todayRange();
    const yesterday = dayRange(1);
    const lastWeek = dayRange(7);

    // Production meters today & yesterday
    const [todayProd, yesterdayProd] = await Promise.all([
      prisma.productionEntry.aggregate({
        _sum: { metersProduced: true },
        where: { isDeleted: false, date: { gte: today.gte, lt: today.lt } },
      }),
      prisma.productionEntry.aggregate({
        _sum: { metersProduced: true },
        where: { isDeleted: false, date: { gte: yesterday.gte, lt: yesterday.lt } },
      }),
    ]);

    const todayProductionMeters = todayProd._sum.metersProduced ?? 0;
    const yesterdayProductionMeters = yesterdayProd._sum.metersProduced ?? 0;
    const todayProductionTrend = computeTrend(todayProductionMeters, yesterdayProductionMeters, 'yesterday');

    // Pending orders count now vs 7 days ago
    const [pendingOrdersCount, pendingOrdersLastWeek] = await Promise.all([
      prisma.order.count({ where: { isDeleted: false, status: 'PENDING' } }),
      prisma.order.count({
        where: { isDeleted: false, status: 'PENDING', createdAt: { lt: lastWeek.lt } },
      }),
    ]);
    const pendingOrdersTrend = computeTrend(pendingOrdersCount, pendingOrdersLastWeek, 'last_week');

    // Overdue payments — clients with outstanding balance and overdue gate passes
    const now = new Date();
    const overdueGatePasses = await prisma.gatePass.findMany({
      where: {
        isDeleted: false,
        paymentDueDate: { lt: now },
        status: { not: GatePassStatus.RECEIVED },
      },
      select: { clientId: true, totalAmountPaisa: true },
    });

    const overdueClientIds = [...new Set(overdueGatePasses.map((gp) => gp.clientId))];

    let overduePaymentsPaisa = 0;
    if (overdueClientIds.length > 0) {
      const lines = await prisma.journalEntryLine.groupBy({
        by: ['clientId'],
        where: { clientId: { in: overdueClientIds } },
        _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
      });

      for (const line of lines) {
        const debit = Number(line._sum.debitAmountPaisa ?? 0);
        const credit = Number(line._sum.creditAmountPaisa ?? 0);
        const outstanding = debit - credit;
        if (outstanding > 0) overduePaymentsPaisa += outstanding;
      }
    }

    const overduePaymentsDisplay = formatPaisaToRupees(overduePaymentsPaisa);

    // Overdue trend vs last week (simplified — recount with paymentDueDate < 7 days ago)
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const overdueGatePassesLastWeek = await prisma.gatePass.findMany({
      where: {
        isDeleted: false,
        paymentDueDate: { lt: lastWeekDate },
        status: { not: GatePassStatus.RECEIVED },
      },
      select: { clientId: true },
    });
    const overdueClientIdsLastWeek = [...new Set(overdueGatePassesLastWeek.map((gp) => gp.clientId))];
    let overdueLastWeekPaisa = 0;
    if (overdueClientIdsLastWeek.length > 0) {
      const linesLW = await prisma.journalEntryLine.groupBy({
        by: ['clientId'],
        where: { clientId: { in: overdueClientIdsLastWeek } },
        _sum: { debitAmountPaisa: true, creditAmountPaisa: true },
      });
      for (const line of linesLW) {
        const debit = Number(line._sum.debitAmountPaisa ?? 0);
        const credit = Number(line._sum.creditAmountPaisa ?? 0);
        const outstanding = debit - credit;
        if (outstanding > 0) overdueLastWeekPaisa += outstanding;
      }
    }
    const overduePaymentsTrend = computeTrend(overduePaymentsPaisa, overdueLastWeekPaisa, 'last_week');

    // Active gate passes today
    const activeGatePassesToday = await prisma.gatePass.count({
      where: {
        isDeleted: false,
        date: { gte: today.gte, lt: today.lt },
        status: { in: [GatePassStatus.CREATED, GatePassStatus.DISPATCHED] },
      },
    });

    // Total stock meters
    const stockAgg = await prisma.finishedGoodsStock.aggregate({
      _sum: { currentMeters: true },
      where: { isDeleted: false },
    });
    const totalStockMeters = stockAgg._sum.currentMeters ?? 0;
    // No historical stock snapshots — return FLAT
    const totalStockTrend: TrendData = { value: 0, direction: 'FLAT', comparedTo: 'yesterday' };

    return {
      todayProductionMeters,
      todayProductionTrend,
      pendingOrdersCount,
      pendingOrdersTrend,
      overduePaymentsPaisa,
      overduePaymentsDisplay,
      overduePaymentsTrend,
      activeGatePassesToday,
      totalStockMeters,
      totalStockTrend,
    };
  }

  // ─── Production Trend ────────────────────────────────────
  async getProductionTrend(period: string, plantId?: string, variantId?: string) {
    const { start, end } = periodToDateRange(period);

    const where: Record<string, unknown> = {
      isDeleted: false,
      date: { gte: start, lt: end },
    };
    if (plantId) where.plantId = plantId;
    if (variantId) where.variantId = variantId;

    const entries = await prisma.productionEntry.findMany({
      where,
      select: {
        date: true,
        metersProduced: true,
        shift: true,
        plant: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Get all plants to map names
    const plants = await prisma.plant.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Group by date
    const byDate = new Map<string, {
      totalMeters: number;
      byPlant: Map<string, number>;
      dayShiftMeters: number;
      nightShiftMeters: number;
    }>();

    for (const entry of entries) {
      const dateKey = toISODate(entry.date);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          totalMeters: 0,
          byPlant: new Map(),
          dayShiftMeters: 0,
          nightShiftMeters: 0,
        });
      }
      const group = byDate.get(dateKey)!;
      group.totalMeters += entry.metersProduced ?? 0;

      const plantName = entry.plant.name;
      group.byPlant.set(plantName, (group.byPlant.get(plantName) ?? 0) + (entry.metersProduced ?? 0));

      if (entry.shift === Shift.DAY) group.dayShiftMeters += entry.metersProduced ?? 0;
      else group.nightShiftMeters += entry.metersProduced ?? 0;
    }

    const dataPoints = Array.from(byDate.entries()).map(([date, data]) => {
      const point: Record<string, unknown> = {
        date,
        totalMeters: data.totalMeters,
        dayShiftMeters: data.dayShiftMeters,
        nightShiftMeters: data.nightShiftMeters,
      };
      // Add per-plant meters using plant names
      for (const plant of plants) {
        const key = `${plant.name.replace(/\s+/g, '')}Meters`;
        point[key] = data.byPlant.get(plant.name) ?? 0;
      }
      return point;
    });

    return { period, dataPoints };
  }

  // ─── Shift Comparison ────────────────────────────────────
  async getShiftComparison(period: string, plantId?: string) {
    const { start, end } = periodToDateRange(period);

    const where: Record<string, unknown> = {
      isDeleted: false,
      date: { gte: start, lt: end },
    };
    if (plantId) where.plantId = plantId;

    const entries = await prisma.productionEntry.findMany({
      where,
      select: { date: true, metersProduced: true, shift: true },
      orderBy: { date: 'asc' },
    });

    let dayShiftTotalMeters = 0;
    let nightShiftTotalMeters = 0;
    const dailyMap = new Map<string, { dayMeters: number; nightMeters: number }>();

    for (const entry of entries) {
      const dateKey = toISODate(entry.date);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { dayMeters: 0, nightMeters: 0 });
      }
      const day = dailyMap.get(dateKey)!;

      if (entry.shift === Shift.DAY) {
        dayShiftTotalMeters += entry.metersProduced ?? 0;
        day.dayMeters += entry.metersProduced ?? 0;
      } else {
        nightShiftTotalMeters += entry.metersProduced ?? 0;
        day.nightMeters += entry.metersProduced ?? 0;
      }
    }

    const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      dayMeters: data.dayMeters,
      nightMeters: data.nightMeters,
    }));

    return { period, dayShiftTotalMeters, nightShiftTotalMeters, dailyBreakdown };
  }

  // ─── Revenue Overview ────────────────────────────────────
  async getRevenueOverview(year: number) {
    // Find Cash/Bank account (code '1000')
    const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });
    if (!cashAccount) {
      return {
        year,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          inflowPaisa: 0,
          inflowDisplay: formatPaisaToRupees(0),
          outflowPaisa: 0,
          outflowDisplay: formatPaisaToRupees(0),
          netPaisa: 0,
          netDisplay: formatPaisaToRupees(0),
        })),
      };
    }

    // Get all posted journal entry lines for this account in the given year
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: cashAccount.id,
        entry: {
          status: JournalEntryStatus.POSTED,
          entryDate: { gte: yearStart, lt: yearEnd },
        },
      },
      select: {
        debitAmountPaisa: true,
        creditAmountPaisa: true,
        entry: { select: { entryDate: true } },
      },
    });

    // Group by month
    const monthlyData = Array.from({ length: 12 }, () => ({ inflow: 0, outflow: 0 }));

    for (const line of lines) {
      const month = line.entry.entryDate.getUTCMonth();
      monthlyData[month].inflow += Number(line.creditAmountPaisa);
      monthlyData[month].outflow += Number(line.debitAmountPaisa);
    }

    const months = monthlyData.map((data, i) => {
      const netPaisa = data.inflow - data.outflow;
      return {
        month: i + 1,
        inflowPaisa: data.inflow,
        inflowDisplay: formatPaisaToRupees(data.inflow),
        outflowPaisa: data.outflow,
        outflowDisplay: formatPaisaToRupees(data.outflow),
        netPaisa,
        netDisplay: formatPaisaToRupees(netPaisa),
      };
    });

    return { year, months };
  }

  // ─── Stock Levels ────────────────────────────────────────
  async getStockLevels() {
    const stocks = await prisma.finishedGoodsStock.findMany({
      where: { isDeleted: false },
      include: {
        variant: { select: { id: true, code: true, name: true } },
      },
      orderBy: { variant: { name: 'asc' } },
    });

    return stocks.map((s) => ({
      variantId: s.variant.id,
      variantCode: s.variant.code,
      variantName: s.variant.name,
      currentMeters: s.currentMeters,
      lowStockThreshold: s.lowStockThreshold,
      isBelowThreshold: s.lowStockThreshold != null && s.currentMeters < s.lowStockThreshold,
    }));
  }

  // ─── Overdue Payments ────────────────────────────────────
  async getOverduePayments() {
    const now = new Date();

    // Get clients with overdue gate passes
    const overdueGatePasses = await prisma.gatePass.findMany({
      where: {
        isDeleted: false,
        paymentDueDate: { lt: now },
        status: { not: GatePassStatus.RECEIVED },
      },
      select: {
        clientId: true,
        totalAmountPaisa: true,
        paymentDueDate: true,
        client: { select: { id: true, name: true } },
      },
    });

    // Group by client
    const clientMap = new Map<string, {
      clientName: string;
      overdueAmountPaisa: number;
      maxDaysOverdue: number;
    }>();

    for (const gp of overdueGatePasses) {
      if (!clientMap.has(gp.clientId)) {
        clientMap.set(gp.clientId, {
          clientName: gp.client.name,
          overdueAmountPaisa: 0,
          maxDaysOverdue: 0,
        });
      }
      const entry = clientMap.get(gp.clientId)!;
      entry.overdueAmountPaisa += Number(gp.totalAmountPaisa);
      const daysOverdue = Math.floor(
        (now.getTime() - gp.paymentDueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysOverdue > entry.maxDaysOverdue) entry.maxDaysOverdue = daysOverdue;
    }

    const totalOverduePaisa = Array.from(clientMap.values()).reduce(
      (sum, c) => sum + c.overdueAmountPaisa,
      0
    );

    const byClient = Array.from(clientMap.entries()).map(([clientId, data]) => ({
      clientId,
      clientName: data.clientName,
      overdueAmountPaisa: data.overdueAmountPaisa,
      overdueAmountDisplay: formatPaisaToRupees(data.overdueAmountPaisa),
      percentOfTotal: totalOverduePaisa > 0
        ? Math.round((data.overdueAmountPaisa / totalOverduePaisa) * 100)
        : 0,
      maxDaysOverdue: data.maxDaysOverdue,
    }));

    // Sort by overdue amount descending
    byClient.sort((a, b) => b.overdueAmountPaisa - a.overdueAmountPaisa);

    return {
      totalOverduePaisa,
      totalOverdueDisplay: formatPaisaToRupees(totalOverduePaisa),
      byClient,
    };
  }

  // ─── Recent Activity ─────────────────────────────────────
  async getRecentActivity(limit = 20) {
    // Fetch recent items from each entity in parallel
    const [gatePasses, orders, vouchers, productionEntries] = await Promise.all([
      prisma.gatePass.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          gatePassNumber: true,
          status: true,
          createdAt: true,
          createdBy: true,
          client: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          metersOrdered: true,
          createdAt: true,
          createdBy: true,
          client: { select: { name: true } },
        },
      }),
      prisma.voucher.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          voucherNumber: true,
          title: true,
          amountPaisa: true,
          approvalStatus: true,
          createdAt: true,
          createdBy: true,
        },
      }),
      prisma.productionEntry.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          metersProduced: true,
          shift: true,
          date: true,
          createdAt: true,
          createdBy: true,
          plant: { select: { name: true } },
          shiftVariants: { select: { variant: { select: { code: true } } } },
        },
      }),
    ]);

    // Map to unified activity items
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      actor: string;
      referenceType: string;
      referenceId: string;
    }> = [];

    for (const gp of gatePasses) {
      activities.push({
        id: gp.id,
        type: 'GATE_PASS',
        title: `Gate Pass ${gp.gatePassNumber}`,
        description: `${gp.status} — ${gp.client.name}`,
        timestamp: gp.createdAt.toISOString(),
        actor: gp.createdBy,
        referenceType: 'GatePass',
        referenceId: gp.id,
      });
    }

    for (const order of orders) {
      activities.push({
        id: order.id,
        type: 'ORDER',
        title: `Order ${order.orderNumber}`,
        description: `${order.status} — ${order.client.name} — ${order.metersOrdered}m`,
        timestamp: order.createdAt.toISOString(),
        actor: order.createdBy,
        referenceType: 'Order',
        referenceId: order.id,
      });
    }

    for (const v of vouchers) {
      activities.push({
        id: v.id,
        type: 'VOUCHER',
        title: `Voucher ${v.voucherNumber}`,
        description: `${v.title} — ${formatPaisaToRupees(Number(v.amountPaisa))} — ${v.approvalStatus}`,
        timestamp: v.createdAt.toISOString(),
        actor: v.createdBy,
        referenceType: 'Voucher',
        referenceId: v.id,
      });
    }

    for (const pe of productionEntries) {
      activities.push({
        id: pe.id,
        type: 'PRODUCTION',
        title: `Production ${pe.shiftVariants.map(sv => sv.variant.code).join(', ') || '—'}`,
        description: `${pe.plant.name} — ${pe.shift} shift — ${pe.metersProduced}m`,
        timestamp: pe.createdAt.toISOString(),
        actor: pe.createdBy,
        referenceType: 'ProductionEntry',
        referenceId: pe.id,
      });
    }

    // Sort by timestamp descending and take top `limit`
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return activities.slice(0, limit);
  }

  // ─── Recent Gate Passes ──────────────────────────────────
  async getRecentGatePasses(limit = 10) {
    const gatePasses = await prisma.gatePass.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        client: { select: { name: true } },
        lineItems: {
          include: {
            variant: { select: { code: true, name: true } },
          },
        },
      },
    });

    return gatePasses.map((gp) => {
      const variantSummaries = gp.lineItems.map(
        (li) => `${li.variant.code} (${li.meters}m)`
      );
      const totalMeters = gp.lineItems.reduce((sum, li) => sum + li.meters, 0);

      return {
        id: gp.id,
        gatePassNumber: gp.gatePassNumber,
        client: gp.client.name,
        variants: variantSummaries.join(', '),
        totalMeters,
        status: gp.status,
        createdAt: gp.createdAt.toISOString(),
        createdBy: gp.createdBy,
      };
    });
  }
}

export const dashboardService = new DashboardService();
