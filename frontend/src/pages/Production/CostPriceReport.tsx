import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, Zap, Package, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { costPriceApi, type ShiftCostBreakdown } from '../../services/cost-price.api';
import { LoadingSpinner } from '../../components/ui';

export function CostPriceReport() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cost-price', { dateFrom, dateTo, page }],
    queryFn: () => costPriceApi.list({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit: 30 }),
  });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cost Price Report</h1>
        <p className="text-sm text-gray-500">Per-shift cost breakdown: electricity + raw material + labor</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            className="self-end rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total Meters"
            value={data.summary.totalMeters.toLocaleString()}
            icon={<Package size={20} />}
            color="blue"
          />
          <SummaryCard
            label="Total Cost"
            value={data.summary.totalCostDisplay}
            icon={<TrendingDown size={20} />}
            color="red"
          />
          <SummaryCard
            label="Avg Cost/Meter"
            value={data.summary.avgCostPerMeterDisplay}
            icon={<TrendingDown size={20} />}
            color="orange"
          />
          <SummaryCard
            label="Entries Shown"
            value={String(data.meta.total)}
            icon={<Zap size={20} />}
            color="purple"
          />
        </div>
      )}

      {isLoading && <LoadingSpinner />}
      {error && <p className="text-red-600">Failed to load cost price data</p>}

      {/* Table */}
      {data && (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Plant / Shift</th>
                  <th className="px-4 py-3 text-left">Variant</th>
                  <th className="px-4 py-3 text-right">Meters</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-right">Cost/m</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      No completed production entries found for selected period
                    </td>
                  </tr>
                )}
                {data.data.map((row) => (
                  <>
                    <tr key={row.productionEntryId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{row.date}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{row.plant}</span>
                        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                          {row.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.variant}</td>
                      <td className="px-4 py-3 text-right">{row.metersProduced.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">{row.totalCostDisplay}</td>
                      <td className="px-4 py-3 text-right text-orange-700 font-medium">{row.costPerMeterDisplay}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleExpand(row.productionEntryId)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {expanded === row.productionEntryId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expanded === row.productionEntryId && (
                      <tr key={`${row.productionEntryId}-detail`}>
                        <td colSpan={7} className="bg-blue-50 px-8 py-4">
                          <CostBreakdownDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600">
              <span>
                Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} entries)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                  disabled={page === data.meta.totalPages}
                  className="rounded border px-3 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'orange' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className={`mb-2 inline-flex rounded-full p-2 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function CostBreakdownDetail({ row }: { row: ShiftCostBreakdown }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-blue-700">
          <Zap size={14} /> Electricity
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Units consumed</span>
          <span>{row.electricityUnitsConsumed.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Rate/unit</span>
          <span>{row.electricityRatePaisaPerUnit}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Electricity cost</span>
          <span>{row.electricityCostDisplay}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-green-700">
          <Package size={14} /> Raw Material
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Bags consumed</span>
          <span>{row.bagsConsumed.toFixed(3)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Avg price/bag</span>
          <span>{row.weightedAvgBagPricePaisa.toFixed(0)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Material cost</span>
          <span>{row.rawMaterialCostDisplay}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-purple-700">
          <Users size={14} /> Labor
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Workers</span>
          <span>{row.workerCount}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Labor cost</span>
          <span>{row.laborCostDisplay}</span>
        </div>
        <div className="mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Total cost</span>
          <span className="text-red-700">{row.totalCostDisplay}</span>
        </div>
      </div>
    </div>
  );
}
