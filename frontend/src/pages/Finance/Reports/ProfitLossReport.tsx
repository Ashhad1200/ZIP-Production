import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import { financeApi } from '../../../services/finance.api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ProfitLossReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['profit-loss', year, month],
    queryFn: () => financeApi.getProfitLoss(year, month),
  });

  const pl = data?.data;

  const netPositive = (pl?.netProfit.paisa ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Profit & Loss Report</h2>
        <p className="mt-1 text-sm text-gray-500">Monthly revenue, cost of goods sold, and overhead breakdown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">Failed to load report. Please try again.</span>
        </div>
      )}

      {pl && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Revenue (Sales)"
              value={pl.revenue.display}
              icon={DollarSign}
              color="blue"
            />
            <KpiCard
              label="Gross Profit"
              value={pl.grossProfit.display}
              icon={pl.grossProfit.paisa >= 0 ? TrendingUp : TrendingDown}
              color={pl.grossProfit.paisa >= 0 ? 'green' : 'red'}
            />
            <KpiCard
              label="Net Profit"
              value={pl.netProfit.display}
              icon={netPositive ? TrendingUp : TrendingDown}
              color={netPositive ? 'green' : 'red'}
            />
          </div>

          {/* Detailed breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Income Statement */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-800">Income Statement</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <Row label="Revenue" value={pl.revenue.display} bold />
                  <Row label="Cost of Goods Sold (COGS)" value={`– ${pl.cogs.display}`} />
                  <Row label="Gross Profit" value={pl.grossProfit.display} bold highlight={pl.grossProfit.paisa >= 0 ? 'green' : 'red'} />
                  <Row label="Total Overheads" value={`– ${pl.overheads.total.display}`} />
                  <Row label="Net Profit" value={pl.netProfit.display} bold highlight={netPositive ? 'green' : 'red'} />
                </tbody>
              </table>
            </div>

            {/* Overhead Breakdown */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-800">Overhead Breakdown</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  <Row label="Labour" value={pl.overheads.labor.display} />
                  <Row label="Rent" value={pl.overheads.rent.display} />
                  <Row label="Transportation" value={pl.overheads.transportation.display} />
                  <Row label="Packing" value={pl.overheads.packing.display} />
                  <Row label="Miscellaneous" value={pl.overheads.miscellaneous.display} />
                  <Row label="Total Overheads" value={pl.overheads.total.display} bold />
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-400">
                Overheads are entered via Production → Monthly Overheads
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  };
  const textMap = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textMap[color]}`}>{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: 'green' | 'red';
}) {
  const textColor = highlight === 'green' ? 'text-green-700' : highlight === 'red' ? 'text-red-700' : 'text-gray-700';
  return (
    <tr>
      <td className={`py-2 pr-4 ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</td>
      <td className={`py-2 text-right font-mono ${bold ? 'font-semibold' : ''} ${textColor}`}>{value}</td>
    </tr>
  );
}
