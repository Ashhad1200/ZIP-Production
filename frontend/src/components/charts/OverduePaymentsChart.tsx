import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi } from '../../services/dashboard.api';
import { formatPaisaToRupees } from '../../utils/currency';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const COLORS = ['#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

export function OverduePaymentsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overdue-payments'],
    queryFn: dashboardApi.getOverduePayments,
  });

  const overdueData = data?.data;
  const clients = overdueData?.byClient ?? [];

  if (isLoading) return <LoadingSpinner size="sm" />;

  if (clients.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        No overdue payments
      </p>
    );
  }

  const chartData = clients.map((c) => ({
    name: c.clientName,
    value: c.overduePaisa / 100,
    paisa: c.overduePaisa,
    percent: c.percentOfTotal,
  }));

  return (
    <div className="relative">
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-500">Total Overdue</p>
          <p className="text-sm font-bold text-gray-900">
            {formatPaisaToRupees(overdueData?.totalOverduePaisa ?? 0, { useShorthand: true })}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => {
              const entry = props?.payload as { paisa?: number; percent?: number } | undefined;
              const paisa = entry?.paisa ?? Number(value) * 100;
              const pct = entry?.percent ?? 0;
              return [`${formatPaisaToRupees(paisa)} (${pct.toFixed(1)}%)`, 'Overdue'];
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value: string) =>
              value.length > 15 ? `${value.slice(0, 15)}…` : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
