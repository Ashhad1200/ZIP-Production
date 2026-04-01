import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { dashboardApi } from '../../services/dashboard.api';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function StockLevelChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stock-levels'],
    queryFn: dashboardApi.getStockLevels,
  });

  const levels = data?.data ?? [];

  if (isLoading) return <LoadingSpinner size="sm" />;

  if (levels.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400">
        No stock data available
      </p>
    );
  }

  const chartData = levels.map((l) => ({
    name: l.variantCode,
    fullName: l.variantName,
    meters: l.currentMeters,
    threshold: l.lowStockThreshold,
    belowThreshold: l.isBelowThreshold,
  }));

  const chartHeight = Math.max(300, levels.length * 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => `${v.toLocaleString()}m`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          width={80}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toLocaleString()} meters`, 'Stock']}
          labelFormatter={(_label, payload) => {
            const first = payload?.[0] as { payload?: { fullName?: string } } | undefined;
            return first?.payload?.fullName ?? '';
          }}
        />
        <Bar dataKey="meters" name="Current Stock" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.belowThreshold ? '#f87171' : '#3b82f6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
