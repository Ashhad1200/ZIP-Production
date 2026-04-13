import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { formatDatePKT } from '../../utils/date';
import { PAGINATION_DEFAULTS } from '../../utils/constants';
import {
  productionApi,
  type ProductionEntry,
  type Shift,
} from '../../services/production.api';

export function ProductionEntries() {
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [plantFilter, setPlantFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Reference data ───────────────────────────────────────────────────────
  const { data: plantsResp } = useQuery({
    queryKey: ['plants'],
    queryFn: productionApi.getPlants,
  });
  const plants = plantsResp?.data ?? [];

  const { data: variantsResp } = useQuery({
    queryKey: ['variants'],
    queryFn: productionApi.getVariants,
  });
  const variants = variantsResp?.data ?? [];

  // ── Production entries ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: [
      'production-entries',
      page,
      plantFilter,
      shiftFilter,
      variantFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      productionApi.getEntries({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        plantId: plantFilter || undefined,
        shift: (shiftFilter as Shift) || undefined,
        variantId: variantFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const entries = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<ProductionEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.date),
    },
    {
      key: 'plant',
      header: 'Plant',
      sortable: true,
      hideOnMobile: true,
      render: (row) => row.plant.name,
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.shift === 'DAY'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-indigo-100 text-indigo-800'
          }`}
        >
          {row.shift === 'DAY' ? '☀️' : '🌙'} {row.shift}
        </span>
      ),
    },
    {
      key: 'variant',
      header: 'Variant',
      sortable: true,
      hideOnMobile: true,
      render: (row) => {
        const codes = row.shiftVariants.map((sv) => sv.variant.code).join(', ');
        const firstSV = row.shiftVariants[0];
        const ingredients = firstSV?.variant.ingredients;
        return (
          <div>
            <span>{codes}</span>
            {ingredients && ingredients.length > 1 && (
              <div className="text-xs text-indigo-500">
                {ingredients.map((i) => `${i.grainTypeName} ${i.ratioPercent.toFixed(0)}%`).join(' + ')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'metersProduced',
      header: 'Meters',
      sortable: true,
      render: (row) =>
        row.metersProduced != null ? row.metersProduced.toLocaleString() : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.status === 'IN_PRODUCTION' ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            In Production
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Completed
          </span>
        ),
    },
    {
      key: 'hasElectricityDiscrepancy',
      header: 'Flag',
      render: (row) =>
        row.hasElectricityDiscrepancy ? (
          <AlertTriangle size={16} className="text-red-500" />
        ) : row.status === 'COMPLETED' ? (
          <span className="text-green-500">✓</span>
        ) : null,
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: ProductionEntry) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {formatDatePKT(row.date)}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              row.shift === 'DAY'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {row.shift}
          </span>
          {row.status === 'IN_PRODUCTION' ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              In Production
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              ✓ Done
            </span>
          )}
          {row.hasElectricityDiscrepancy && (
            <AlertTriangle size={14} className="text-red-500" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{row.plant.name}</span>
        <span className="font-medium">{row.shiftVariants.map((sv) => sv.variant.code).join(', ')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>
          <span className="block text-gray-400">Meters</span>
          {row.metersProduced != null ? row.metersProduced.toLocaleString() : '—'}
        </div>
        <div>
          <span className="block text-gray-400">Variants</span>
          {row.shiftVariants.length}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Production Entries
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            View and manage production records
          </p>
        </div>
        <button
          onClick={() => navigate('/production/new')}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <SearchableSelect
          options={[
            { value: '', label: 'All Plants' },
            ...plants.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={plantFilter}
          onChange={(v) => {
            setPlantFilter(v);
            setPage(1);
          }}
          placeholder="All Plants"
          clearable
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Shifts' },
            { value: 'DAY', label: '☀️ Day' },
            { value: 'NIGHT', label: '🌙 Night' },
          ]}
          value={shiftFilter}
          onChange={(v) => {
            setShiftFilter(v);
            setPage(1);
          }}
          placeholder="All Shifts"
          clearable
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Variants' },
            ...variants.map((v) => ({ value: v.id, label: v.name })),
          ]}
          value={variantFilter}
          onChange={(v) => {
            setVariantFilter(v);
            setPage(1);
          }}
          placeholder="All Variants"
          clearable
        />
        <DatePicker
          label=""
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            setPage(1);
          }}
        />
        <DatePicker
          label=""
          value={dateTo}
          onChange={(v) => {
            setDateTo(v);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={entries}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) =>
            row.status === 'IN_PRODUCTION'
              ? navigate(`/production/${row.id}/complete`)
              : navigate(`/production/${row.id}`)
          }
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No production entries found"
        />
      </div>
    </div>
  );
}
