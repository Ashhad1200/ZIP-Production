import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ExternalLink, AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { useRole } from '../../hooks/useRole';
import { formatDatePKT } from '../../utils/date';
import { PAGINATION_DEFAULTS } from '../../utils/constants';
import {
  productionApi,
  type DiscrepancyEntry,
} from '../../services/production.api';

export function Discrepancies() {
  const { isAdmin } = useRole();

  // ── Access guard ─────────────────────────────────────────────────────────
  if (!isAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <ShieldAlert size={48} strokeWidth={1.5} />
        <p className="mt-3 text-sm">
          Only Super Admins can access electricity discrepancies.
        </p>
      </div>
    );
  }

  return <DiscrepanciesContent />;
}

function DiscrepanciesContent() {
  const navigate = useNavigate();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [plantFilter, setPlantFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Reference data ───────────────────────────────────────────────────────
  const { data: plantsResp } = useQuery({
    queryKey: ['plants'],
    queryFn: productionApi.getPlants,
  });
  const plants = plantsResp?.data ?? [];

  // ── Discrepancies ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['discrepancies', page, plantFilter, dateFrom, dateTo],
    queryFn: () =>
      productionApi.getDiscrepancies({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        plantId: plantFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const items = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<DiscrepancyEntry>[] = [
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
          {row.shift}
        </span>
      ),
    },
    {
      key: 'variant',
      header: 'Variant',
      hideOnMobile: true,
      render: (row) => `${row.variant.code} – ${row.variant.name}`,
    },
    {
      key: 'metersProduced',
      header: 'Meters',
      sortable: true,
      hideOnMobile: true,
      render: (row) => row.metersProduced.toLocaleString(),
    },
    {
      key: 'electricityUnitsConsumed',
      header: 'Elec. Units',
      sortable: true,
      render: (row) => row.electricityUnitsConsumed.toLocaleString(),
    },
    {
      key: 'notes',
      header: 'Notes',
      hideOnMobile: true,
      render: (row) => (
        <span className="max-w-[200px] truncate text-xs text-gray-500">
          {row.electricityDiscrepancyNotes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/production/${row.id}`);
          }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"
          aria-label="View entry"
        >
          <ExternalLink size={16} />
        </button>
      ),
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: DiscrepancyEntry) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {formatDatePKT(row.date)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.shift === 'DAY'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-indigo-100 text-indigo-800'
          }`}
        >
          {row.shift}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{row.plant.name}</span>
        <span className="font-medium text-red-600">
          {row.electricityUnitsConsumed.toLocaleString()} units
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>
          <span className="block text-gray-400">Variant</span>
          {row.variant.code}
        </div>
        <div>
          <span className="block text-gray-400">Meters</span>
          {row.metersProduced.toLocaleString()}
        </div>
      </div>
      {row.electricityDiscrepancyNotes && (
        <p className="text-xs text-gray-500 italic">
          {row.electricityDiscrepancyNotes}
        </p>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={24} className="text-red-500" />
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Electricity Discrepancies
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Flagged production entries with abnormal electricity consumption
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
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
          data={items}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/production/${row.id}`)}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No discrepancies found"
        />
      </div>
    </div>
  );
}
