import api from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrendData {
  value: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  comparedTo: string;
}

export interface KPIData {
  todayProductionMeters: number;
  todayProductionTrend: TrendData;
  pendingOrdersCount: number;
  pendingOrdersTrend: TrendData;
  overduePaymentsPaisa: number;
  overduePaymentsDisplay: string;
  overduePaymentsTrend: TrendData;
  activeGatePassesToday: number;
  totalStockMeters: number;
  totalStockTrend: TrendData;
}

export interface ProductionDataPoint {
  date: string;
  totalMeters: number;
  plant1Meters: number;
  plant2Meters: number;
  dayShiftMeters: number;
  nightShiftMeters: number;
}

export interface ProductionTrendData {
  period: string;
  dataPoints: ProductionDataPoint[];
}

export interface ShiftComparisonData {
  period: string;
  dayShiftTotalMeters: number;
  nightShiftTotalMeters: number;
  dailyBreakdown: { date: string; dayMeters: number; nightMeters: number }[];
}

export interface RevenueMonth {
  month: string;
  inflowPaisa: number;
  inflowDisplay: string;
  outflowPaisa: number;
  outflowDisplay: string;
  netPaisa: number;
  netDisplay: string;
}

export interface RevenueData {
  year: number;
  months: RevenueMonth[];
}

export interface StockLevel {
  variantId: string;
  variantCode: string;
  variantName: string;
  currentMeters: number;
  lowStockThreshold: number | null;
  isBelowThreshold: boolean;
}

export interface OverdueClient {
  clientId: string;
  clientName: string;
  overduePaisa: number;
  overdueDisplay: string;
  percentOfTotal: number;
  maxDaysOverdue: number;
}

export interface OverduePaymentsData {
  totalOverduePaisa: number;
  totalOverdueDisplay: string;
  byClient: OverdueClient[];
}

export interface ActivityItem {
  id: string;
  type: 'GATE_PASS' | 'ORDER' | 'VOUCHER' | 'PRODUCTION';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  referenceType: string;
  referenceId: string;
}

export interface RecentGatePass {
  id: string;
  gatePassNumber: string;
  client: string;
  variants: string;
  totalMeters: number;
  status: string;
  createdAt: string;
  createdBy: string;
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKPIs: () =>
    api.get<{ data: KPIData }>('/dashboard/kpis').then((r) => r.data),

  getProductionTrend: (period = '30d', plantId?: string, variantId?: string) =>
    api
      .get<{ data: ProductionTrendData }>('/dashboard/production-trend', {
        params: { period, plantId, variantId },
      })
      .then((r) => r.data),

  getShiftComparison: (period = '30d', plantId?: string) =>
    api
      .get<{ data: ShiftComparisonData }>('/dashboard/shift-comparison', {
        params: { period, plantId },
      })
      .then((r) => r.data),

  getRevenueOverview: (year?: number) =>
    api
      .get<{ data: RevenueData }>('/dashboard/revenue-overview', {
        params: { year },
      })
      .then((r) => r.data),

  getStockLevels: () =>
    api
      .get<{ data: StockLevel[] }>('/dashboard/stock-levels')
      .then((r) => r.data),

  getOverduePayments: () =>
    api
      .get<{ data: OverduePaymentsData }>('/dashboard/overdue-payments')
      .then((r) => r.data),

  getRecentActivity: (limit = 20) =>
    api
      .get<{ data: ActivityItem[] }>('/dashboard/recent-activity', {
        params: { limit },
      })
      .then((r) => r.data),

  getRecentGatePasses: (limit = 10) =>
    api
      .get<{ data: RecentGatePass[] }>('/dashboard/recent-gate-passes', {
        params: { limit },
      })
      .then((r) => r.data),
};
