import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi } from '../../services/dashboard.api';
import { formatPaisaToRupees } from '../../utils/currency';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function RevenueChart() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-revenue', year],
    queryFn: () => dashboardApi.getRevenueOverview(year),
  });

  const months = data?.data?.months ?? [];

  const chartData = months.map((m) => ({
    month: m.month,
    inflow: m.inflowPaisa / 100,
    outflow: m.outflowPaisa / 100,
  }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      {/* Year selector */}
      <div className="mb-4">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          No revenue data for {year}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) =>
                formatPaisaToRupees(v * 100, { useShorthand: true })
              }
            />
            <Tooltip
              formatter={(value) => [
                formatPaisaToRupees(Number(value) * 100),
              ]}
              labelFormatter={(label) => String(label)}
            />
            <Legend />
            <Bar dataKey="inflow" name="Inflow" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outflow" name="Outflow" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
