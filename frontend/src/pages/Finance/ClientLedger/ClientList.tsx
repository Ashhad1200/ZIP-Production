import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '../../../components/ui';
import { useSmartQuery } from '../../../hooks/useSmartQuery';
import { financeApi, type ClientWithBalance } from '../../../services/finance.api';
import { formatPaisaToRupees } from '../../../utils/currency';
import { POLLING_INTERVALS, PAGINATION_DEFAULTS } from '../../../utils/constants';

export function ClientList() {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [search, setSearch] = useState('');
  const [hasOverdue, setHasOverdue] = useState(false);

  const { data, isLoading } = useSmartQuery({
    queryKey: ['finance-clients', page, search, hasOverdue],
    queryFn: () =>
      financeApi.getClients({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        search: search || undefined,
        hasOverdue: hasOverdue || undefined,
      }),
    pollingInterval: POLLING_INTERVALS.FINANCE,
  });

  const clients = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  const columns: Column<ClientWithBalance>[] = [
    {
      key: 'name',
      header: 'Client Name',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'paymentCycleDays',
      header: 'Payment Cycle',
      hideOnMobile: true,
      render: (row) => `${row.paymentCycleDays} days`,
    },
    {
      key: 'totalDebits',
      header: 'Total Debits',
      hideOnMobile: true,
      render: (row) => formatPaisaToRupees(row.totalDebitsPaisa),
    },
    {
      key: 'totalCredits',
      header: 'Total Credits',
      hideOnMobile: true,
      render: (row) => formatPaisaToRupees(row.totalCreditsPaisa),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      sortable: true,
      render: (row) => (
        <span
          className={
            row.outstandingPaisa > 0
              ? 'font-semibold text-red-600'
              : 'text-gray-900'
          }
        >
          {formatPaisaToRupees(row.outstandingPaisa)}
        </span>
      ),
    },
    {
      key: 'overdueAmount',
      header: 'Overdue',
      hideOnMobile: true,
      render: (row) => (
        <span
          className={
            row.overdueAmountPaisa > 0 ? 'font-semibold text-red-600' : ''
          }
        >
          {row.overdueAmountPaisa > 0
            ? formatPaisaToRupees(row.overdueAmountPaisa)
            : '—'}
        </span>
      ),
    },
    {
      key: 'maxDaysOverdue',
      header: 'Max Overdue',
      hideOnMobile: true,
      sortable: true,
      render: (row) =>
        row.maxDaysOverdue > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle size={12} />
            {row.maxDaysOverdue}d
          </span>
        ) : (
          '—'
        ),
    },
  ];

  const mobileCard = (row: ClientWithBalance) => (
    <div className="space-y-2 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">{row.name}</span>
        <span className="text-xs text-gray-500">
          {row.paymentCycleDays}d cycle
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">Outstanding</span>
          <p
            className={
              row.outstandingPaisa > 0
                ? 'font-semibold text-red-600'
                : 'text-gray-900'
            }
          >
            {formatPaisaToRupees(row.outstandingPaisa)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Overdue</span>
          <p
            className={
              row.overdueAmountPaisa > 0
                ? 'font-semibold text-red-600'
                : 'text-gray-900'
            }
          >
            {row.overdueAmountPaisa > 0
              ? formatPaisaToRupees(row.overdueAmountPaisa)
              : '—'}
          </p>
        </div>
      </div>
      {row.maxDaysOverdue > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle size={12} />
          {row.maxDaysOverdue} days overdue
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Client Ledger
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Client balances and outstanding payments
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(PAGINATION_DEFAULTS.PAGE);
            }}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm">
          <input
            type="checkbox"
            checked={hasOverdue}
            onChange={(e) => {
              setHasOverdue(e.target.checked);
              setPage(PAGINATION_DEFAULTS.PAGE);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Has overdue
        </label>
      </div>

      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/finance/client-ledger/${row.id}`)}
        keyExtractor={(row) => row.id}
        mobileCard={mobileCard}
        emptyMessage="No clients found"
      />
    </div>
  );
}
