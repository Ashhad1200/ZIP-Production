import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { formatPaisaToRupees } from '../../utils/currency';
import {
  inventoryApi,
  type ConsumptionGrainData,
} from '../../services/inventory.api';

const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'custom', label: 'Custom' },
];

export function ConsumptionReport() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [period, setPeriod] = useState('current_month');
  const [rawMaterialTypeFilter, setRawMaterialTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Reference data ───────────────────────────────────────────────────────
  const { data: rawMaterialsResp } = useQuery({
    queryKey: ['raw-material-stock'],
    queryFn: inventoryApi.getRawMaterials,
  });
  const rawMaterialTypes = rawMaterialsResp?.data ?? [];

  // ── Consumption report ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['consumption-report', period, rawMaterialTypeFilter, dateFrom, dateTo],
    queryFn: () =>
      inventoryApi.getConsumptionReport({
        period: period !== 'custom' ? period : undefined,
        rawMaterialTypeId: rawMaterialTypeFilter || undefined,
        dateFrom: period === 'custom' && dateFrom ? dateFrom : undefined,
        dateTo: period === 'custom' && dateTo ? dateTo : undefined,
      }),
  });

  const report = data?.data;
  const grainData = report?.rawMaterialTypes ?? [];

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = grainData.reduce(
    (acc, row) => ({
      purchasedBags: acc.purchasedBags + row.purchasedBags,
      consumedBags: acc.consumedBags + row.consumedBags,
      netChange: acc.netChange + row.netChange,
      currentStock: acc.currentStock + row.currentStock,
    }),
    { purchasedBags: 0, consumedBags: 0, netChange: 0, currentStock: 0 },
  );

  // ── Period label ─────────────────────────────────────────────────────────
  const periodLabel =
    report?.period ||
    PERIOD_OPTIONS.find((p) => p.value === period)?.label ||
    'Report';

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<ConsumptionGrainData>[] = [
    {
      key: 'rawMaterialType',
      header: 'Raw Material Type',
      sortable: true,
      render: (row) => row.rawMaterialType,
    },
    {
      key: 'purchasedBags',
      header: 'Purchased',
      sortable: true,
      render: (row) => row.purchasedBags.toLocaleString(),
    },
    {
      key: 'consumedBags',
      header: 'Consumed',
      sortable: true,
      render: (row) => row.consumedBags.toLocaleString(),
    },
    {
      key: 'netChange',
      header: 'Net Change',
      sortable: true,
      render: (row) => (
        <span
          className={`font-medium ${
            row.netChange > 0
              ? 'text-green-600'
              : row.netChange < 0
                ? 'text-red-600'
                : 'text-gray-600'
          }`}
        >
          {row.netChange > 0 ? '+' : ''}
          {row.netChange.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'currentStock',
      header: 'Current Stock',
      sortable: true,
      hideOnMobile: true,
      render: (row) => row.currentStock.toLocaleString(),
    },
    {
      key: 'weightedAvgCostPaisa',
      header: 'Avg Cost/Bag',
      sortable: true,
      hideOnMobile: true,
      render: (row) => formatPaisaToRupees(row.weightedAvgCostPaisa),
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: ConsumptionGrainData) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {row.rawMaterialType}
        </span>
        <span
          className={`text-sm font-medium ${
            row.netChange > 0
              ? 'text-green-600'
              : row.netChange < 0
                ? 'text-red-600'
                : 'text-gray-600'
          }`}
        >
          {row.netChange > 0 ? '+' : ''}
          {row.netChange.toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div>
          <span className="block text-gray-400">Purchased</span>
          {row.purchasedBags.toLocaleString()}
        </div>
        <div>
          <span className="block text-gray-400">Consumed</span>
          {row.consumedBags.toLocaleString()}
        </div>
        <div>
          <span className="block text-gray-400">Stock</span>
          {row.currentStock.toLocaleString()}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        Avg Cost: {formatPaisaToRupees(row.weightedAvgCostPaisa)}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Consumption Report
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{periodLabel}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelect
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          placeholder="Select period"
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Raw Material Types' },
            ...rawMaterialTypes.map((g) => ({
              value: g.rawMaterialType.id,
              label: g.rawMaterialType.name,
            })),
          ]}
          value={rawMaterialTypeFilter}
          onChange={setRawMaterialTypeFilter}
          placeholder="All Raw Material Types"
          clearable
        />
        {period === 'custom' && (
          <>
            <DatePicker
              label="From"
              value={dateFrom}
              onChange={setDateFrom}
            />
            <DatePicker
              label="To"
              value={dateTo}
              onChange={setDateTo}
            />
          </>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={grainData}
          isLoading={isLoading}
          keyExtractor={(row) => row.rawMaterialType}
          mobileCard={mobileCard}
          emptyMessage="No consumption data for selected period"
        />
      </div>

      {/* Summary row */}
      {grainData.length > 0 && (
        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Totals
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="block text-xs text-gray-400">
                Total Purchased
              </span>
              <span className="text-sm font-medium text-gray-900">
                {totals.purchasedBags.toLocaleString()} bags
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-400">
                Total Consumed
              </span>
              <span className="text-sm font-medium text-gray-900">
                {totals.consumedBags.toLocaleString()} bags
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-400">
                Net Change
              </span>
              <span
                className={`text-sm font-medium ${
                  totals.netChange > 0
                    ? 'text-green-600'
                    : totals.netChange < 0
                      ? 'text-red-600'
                      : 'text-gray-900'
                }`}
              >
                {totals.netChange > 0 ? '+' : ''}
                {totals.netChange.toLocaleString()} bags
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-400">
                Total Current Stock
              </span>
              <span className="text-sm font-medium text-gray-900">
                {totals.currentStock.toLocaleString()} bags
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
