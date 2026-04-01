import { Factory, ShoppingCart, AlertTriangle, Package } from 'lucide-react';
import { KPICard } from '../../components/ui/KPICard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useSmartQuery } from '../../hooks/useSmartQuery';
import { useRole } from '../../hooks/useRole';
import { POLLING_INTERVALS, ROLES } from '../../utils/constants';
import { dashboardApi } from '../../services/dashboard.api';
import type { TrendData } from '../../services/dashboard.api';
import { ProductionTrendChart } from '../../components/charts/ProductionTrendChart';
import { ShiftComparisonChart } from '../../components/charts/ShiftComparisonChart';
import { RevenueChart } from '../../components/charts/RevenueChart';
import { StockLevelChart } from '../../components/charts/StockLevelChart';
import { OverduePaymentsChart } from '../../components/charts/OverduePaymentsChart';
import { RecentActivity } from './RecentActivity';

/** Map API trend shape to KPICard's expected shape */
function mapTrend(t: TrendData | undefined) {
  if (!t) return undefined;
  return {
    direction: t.direction.toLowerCase() as 'up' | 'down' | 'flat',
    value: `${Math.abs(t.value)}% vs ${t.comparedTo}`,
  };
}

export default function DashboardPage() {
  const { hasRole } = useRole();
  const isFinance = hasRole(ROLES.SUPER_ADMIN, ROLES.FINANCE_HEAD);

  const { data: kpiData, isLoading } = useSmartQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: dashboardApi.getKPIs,
    pollingInterval: POLLING_INTERVALS.DASHBOARD,
  });

  const kpis = kpiData?.data;

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">Real-time factory overview</p>
      </div>

      {/* KPI Cards — 2x2 mobile, 4-across desktop */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          title="Today's Production"
          value={`${(kpis?.todayProductionMeters ?? 0).toLocaleString()}m`}
          trend={mapTrend(kpis?.todayProductionTrend)}
          icon={<Factory size={20} />}
        />
        <KPICard
          title="Pending Orders"
          value={kpis?.pendingOrdersCount ?? 0}
          trend={mapTrend(kpis?.pendingOrdersTrend)}
          icon={<ShoppingCart size={20} />}
        />
        {isFinance && (
          <KPICard
            title="Overdue Payments"
            value={kpis?.overduePaymentsDisplay ?? 'Rs 0.00'}
            trend={mapTrend(kpis?.overduePaymentsTrend)}
            icon={<AlertTriangle size={20} />}
            className="border-red-200"
          />
        )}
        <KPICard
          title="Total Stock"
          value={`${(kpis?.totalStockMeters ?? 0).toLocaleString()}m`}
          trend={mapTrend(kpis?.totalStockTrend)}
          icon={<Package size={20} />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-4 font-semibold text-gray-900">Production Trend</h3>
          <ProductionTrendChart />
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-4 font-semibold text-gray-900">Shift Comparison</h3>
          <ShiftComparisonChart />
        </div>
      </div>

      {/* Charts Row 2 — Finance-only */}
      {isFinance && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Revenue Overview</h3>
            <RevenueChart />
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-semibold text-gray-900">Overdue Payments</h3>
            <OverduePaymentsChart />
          </div>
        </div>
      )}

      {/* Stock Levels */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-semibold text-gray-900">Stock Levels</h3>
        <StockLevelChart />
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
}
