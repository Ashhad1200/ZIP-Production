import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi } from '../../services/dashboard.api';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const PERIODS = ['7d', '30d', '90d', '12m'] as const;
type Period = (typeof PERIODS)[number];

export function ProductionTrendChart() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-production-trend', period],
    queryFn: () => dashboardApi.getProductionTrend(period),
  });

  const dataPoints = data?.data?.dataPoints ?? [];

  return (
    <div>
      {/* Period selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              period === p
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : dataPoints.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          No production data for this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={dataPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `${v.toLocaleString()}m`}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString()} meters`, 'Total']}
              labelFormatter={(label) => {
                const d = new Date(String(label));
                return d.toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="totalMeters"
              name="Total Meters"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
