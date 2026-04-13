import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, Zap, Package, Users, ChevronDown, ChevronUp, Boxes, FlaskConical, Recycle, BarChart3 } from 'lucide-react';
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
        <p className="text-sm text-gray-500">Per-shift cost breakdown with scrap credit &amp; percentage analysis</p>
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
                      <td className="px-4 py-3 text-gray-600">
                        <div>{row.variant}</div>
                        {row.recipe && row.recipe.ingredients.length > 1 && (
                          <div className="mt-0.5 text-xs text-indigo-500">
                            {row.recipe.ingredients.map((i) => `${i.grainTypeCode} ${i.ratioPercent.toFixed(0)}%`).join(' + ')}
                          </div>
                        )}
                      </td>
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
    <div className="space-y-4">
      {/* Recipe / Formula badge */}
      {row.recipe && row.recipe.ingredients.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
          <FlaskConical size={14} className="text-indigo-600" />
          <span className="font-semibold text-indigo-700">Formula:</span>
          <span className="text-indigo-600">
            {row.recipe.ingredients.map((i) => `${i.grainTypeName} ${i.ratioPercent.toFixed(0)}%`).join(' + ')}
          </span>
        </div>
      )}

      {/* Cost component percentage breakdown bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <BarChart3 size={14} /> Cost Breakdown (%)
        </div>
        <div className="mb-2 flex h-6 w-full overflow-hidden rounded-full">
          {row.rawMaterialPct > 0 && (
            <div className="bg-green-500" style={{ width: `${row.rawMaterialPct}%` }} title={`Raw Material ${row.rawMaterialPct.toFixed(1)}%`} />
          )}
          {row.electricityPct > 0 && (
            <div className="bg-blue-500" style={{ width: `${row.electricityPct}%` }} title={`Electricity ${row.electricityPct.toFixed(1)}%`} />
          )}
          {row.laborPct > 0 && (
            <div className="bg-purple-500" style={{ width: `${row.laborPct}%` }} title={`Labor ${row.laborPct.toFixed(1)}%`} />
          )}
          {row.packagingPct > 0 && (
            <div className="bg-amber-500" style={{ width: `${row.packagingPct}%` }} title={`Packaging ${row.packagingPct.toFixed(1)}%`} />
          )}
          {row.overheadPct > 0 && (
            <div className="bg-orange-400" style={{ width: `${row.overheadPct}%` }} title={`Overhead ${row.overheadPct.toFixed(1)}%`} />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> Raw Material {row.rawMaterialPct.toFixed(1)}%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Electricity {row.electricityPct.toFixed(1)}%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500" /> Labor {row.laborPct.toFixed(1)}%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Packaging {row.packagingPct.toFixed(1)}%</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" /> Overhead {row.overheadPct.toFixed(1)}%</span>
          {row.scrapCreditPct > 0 && (
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-500" /> Scrap Credit -{row.scrapCreditPct.toFixed(1)}%</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-blue-700">
            <Zap size={14} /> Electricity
            <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium">{row.electricityPct.toFixed(1)}%</span>
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
            <span className="ml-auto rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium">{row.rawMaterialPct.toFixed(1)}%</span>
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
          <div className="flex items-center gap-1.5 font-semibold text-amber-700">
            <Boxes size={14} /> Packaging
            <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium">{row.packagingPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Units consumed</span>
            <span>{row.packagingUnitsConsumed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Avg rate/unit</span>
            <span>{row.weightedAvgPackagingRatePaisa.toFixed(0)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Packaging cost</span>
            <span>{row.packagingCostDisplay}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-purple-700">
            <Users size={14} /> Labor (per-shift)
            <span className="ml-auto rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium">{row.laborPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Workers</span>
            <span>{row.workerCount}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Labor cost</span>
            <span>{row.laborCostDisplay}</span>
          </div>
        </div>
      </div>

      {/* Per-ingredient cost breakdown */}
      {row.ingredientCosts && row.ingredientCosts.length > 1 && (
        <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-green-700">
            <FlaskConical size={14} /> Per-Ingredient Cost Breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-green-200 text-left text-green-600">
                  <th className="pb-1 pr-4">Grain Type</th>
                  <th className="pb-1 pr-4 text-right">Recipe %</th>
                  <th className="pb-1 pr-4 text-right">Bags Used</th>
                  <th className="pb-1 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {row.ingredientCosts.map((ic) => (
                  <tr key={ic.grainTypeCode} className="border-b border-green-100 last:border-0">
                    <td className="py-1 pr-4 font-medium text-gray-700">{ic.grainTypeName}</td>
                    <td className="py-1 pr-4 text-right text-gray-500">{ic.standardRatioPercent.toFixed(0)}%</td>
                    <td className="py-1 pr-4 text-right">{ic.actualBagsConsumed.toFixed(3)}</td>
                    <td className="py-1 text-right font-medium">{ic.actualCostDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scrap credit */}
      {row.scrapWeightGrams > 0 && (
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-teal-700">
            <Recycle size={14} /> Scrap Credit
            {row.scrapCreditPct > 0 && (
              <span className="ml-auto rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium">-{row.scrapCreditPct.toFixed(1)}%</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div className="flex justify-between"><span className="text-gray-500">Scrap weight</span><span>{(row.scrapWeightGrams / 1000).toFixed(2)} kg</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rate/kg</span><span>{row.scrapRatePerKgPaisa}</span></div>
            <div className="flex justify-between font-semibold text-teal-700"><span>Credit</span><span>-{row.scrapCreditDisplay}</span></div>
          </div>
        </div>
      )}

      {/* Monthly overhead allocation */}
      {Number(row.overheadTotalPaisa) > 0 && (
        <div className="rounded-lg border border-orange-100 bg-orange-50 p-3 text-sm">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-orange-700">
            <TrendingDown size={14} /> Monthly Overhead Allocation
            <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium">{row.overheadPct.toFixed(1)}%</span>
            <span className="ml-auto text-xs font-normal text-orange-500">
              ({row.monthlyTotalMeters.toLocaleString()}m produced this month)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div className="flex justify-between"><span className="text-gray-500">Labor (monthly)</span><span>{row.overheadLaborDisplay}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Rent (monthly)</span><span>{row.overheadRentDisplay}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Transportation</span><span>{row.overheadTransportationDisplay}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Packing</span><span>{row.overheadPackingDisplay}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Miscellaneous</span><span>{row.overheadMiscellaneousDisplay}</span></div>
            <div className="flex justify-between font-semibold text-orange-700"><span>Overhead/meter</span><span>{row.overheadPerMeterDisplay}</span></div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="space-y-1 border-t pt-2 text-sm">
        {row.scrapWeightGrams > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Cost before scrap credit</span>
            <span>{row.totalCostBeforeScrapDisplay}</span>
          </div>
        )}
        {row.scrapWeightGrams > 0 && (
          <div className="flex justify-between text-teal-600">
            <span>Scrap credit</span>
            <span>-{row.scrapCreditDisplay}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Net total cost</span>
          <span className="text-red-700">{row.totalCostDisplay}</span>
        </div>
      </div>
    </div>
  );
}
