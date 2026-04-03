import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { gatePassApi, type GatePassFilters, type GatePassStatus, type Shift, type GatePass } from '../../services/gate-pass.api';
import { DataTable, type Column, StatusBadge } from '../../components/ui';
import { SearchableSelect, DatePicker } from '../../components/forms';
import { PAGINATION_DEFAULTS } from '../../utils/constants';

export function GatePassList() {
  const navigate = useNavigate();

  // Filters
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('');
  const [shift, setShift] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Lookups
  const { data: clientsData } = useQuery({
    queryKey: ['gatepass-clients'],
    queryFn: () => gatePassApi.getClients(),
  });
  const clients = clientsData?.data ?? [];

  // Data query
  const filters: GatePassFilters = {
    page,
    limit: PAGINATION_DEFAULTS.LIMIT,
    clientId: clientId || undefined,
    status: (status as GatePassStatus) || undefined,
    shift: (shift as Shift) || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data: listData, isLoading } = useQuery({
    queryKey: ['gate-passes', filters],
    queryFn: () => gatePassApi.list(filters),
  });

  const gatePasses = listData?.data ?? [];
  const totalPages = listData?.meta?.totalPages ?? 1;

  const resetFilters = () => {
    setClientId('');
    setStatus('');
    setShift('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const columns: Column<GatePass>[] = [
    {
      key: 'gatePassNumber',
      header: 'GP #',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-blue-700">{row.gatePassNumber}</span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (row) => row.client.name,
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => {
        const d = new Date(row.date + 'T00:00:00');
        return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
      },
    },
    {
      key: 'shift',
      header: 'Shift',
      render: (row) => (
        <span>{row.shift === 'DAY' ? '☀️ Day' : '🌙 Night'}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'variants',
      header: 'Variants',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-gray-600 text-xs">
          {row.lineItems.map((li) => `${li.variant.code} (${li.meters}m)`).join(', ')}
        </span>
      ),
    },
  ];

  const mobileCard = (row: GatePass) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-blue-700">{row.gatePassNumber}</span>
        <StatusBadge status={row.status} />
      </div>
      <div className="text-sm text-gray-700">{row.client.name}</div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{new Date(row.date + 'T00:00:00').toLocaleDateString('en-PK')}</span>
        <span>{row.shift === 'DAY' ? '☀️ Day' : '🌙 Night'}</span>
      </div>
      <div className="text-xs text-gray-600">
        {row.lineItems.map((li) => `${li.variant.code} (${li.meters}m)`).join(', ')}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gate Passes</h1>
        <button
          onClick={() => navigate('/gate-pass/new')}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} /> New Gate Pass
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <SearchableSelect
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onChange={(v) => { setClientId(v); setPage(1); }}
            placeholder="All clients"
            clearable
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="CREATED">Created</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RECEIVED">Received</option>
          </select>
          <select
            value={shift}
            onChange={(e) => { setShift(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All shifts</option>
            <option value="DAY">☀️ Day</option>
            <option value="NIGHT">🌙 Night</option>
          </select>
          <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} placeholder="From date" />
          <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} placeholder="To date" />
        </div>
        {(clientId || status || shift || dateFrom || dateTo) && (
          <button
            onClick={resetFilters}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={gatePasses}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/gate-pass/${row.id}`)}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No gate passes found"
        />
      </div>
    </div>
  );
}
