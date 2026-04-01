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
import { LoadingSpinner } from '../ui/LoadingSpinner';

const PERIODS = ['7d', '30d', '90d'] as const;
type Period = (typeof PERIODS)[number];

export function ShiftComparisonChart() {
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-shift-comparison', period],
    queryFn: () => dashboardApi.getShiftComparison(period),
  });

  const shiftData = data?.data;
  const breakdown = shiftData?.dailyBreakdown ?? [];

  return (
    <div>
      {/* Summary */}
      {shiftData && (
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <span className="font-medium text-blue-600">
            Day: {shiftData.dayShiftTotalMeters.toLocaleString()}m
          </span>
          <span className="font-medium text-indigo-600">
            Night: {shiftData.nightShiftTotalMeters.toLocaleString()}m
          </span>
        </div>
      )}

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
      ) : breakdown.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          No shift data for this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={breakdown}>
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
              formatter={(value, name) => [
                `${Number(value).toLocaleString()} meters`,
                String(name),
              ]}
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
            <Bar dataKey="dayMeters" name="Day Shift" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="nightMeters" name="Night Shift" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
