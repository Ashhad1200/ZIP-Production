import { AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '../../../components/ui';
import { financeApi, type OverdueEntry } from '../../../services/finance.api';
import { formatPaisaToRupees } from '../../../utils/currency';
import { formatDatePKT } from '../../../utils/date';
import { POLLING_INTERVALS } from '../../../utils/constants';
import { useSmartQuery } from '../../../hooks/useSmartQuery';

export function OverduePayments() {
  const { data, isLoading } = useSmartQuery({
    queryKey: ['finance-overdue'],
    queryFn: () => financeApi.getOverdue(),
    pollingInterval: POLLING_INTERVALS.FINANCE,
  });

  const entries = data?.data ?? [];

  const totalOverduePaisa = entries.reduce(
    (sum, e) => sum + e.amountPaisa,
    0,
  );

  const columns: Column<OverdueEntry>[] = [
    {
      key: 'clientName',
      header: 'Client',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.clientName}</span>
      ),
    },
    {
      key: 'gatePassNumber',
      header: 'GP Number',
      render: (row) => row.gatePassNumber,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {formatPaisaToRupees(row.amountPaisa)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => formatDatePKT(row.dueDate),
    },
    {
      key: 'daysOverdue',
      header: 'Days Overdue',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 font-bold text-red-600">
          <AlertTriangle size={14} />
          {row.daysOverdue}d
        </span>
      ),
    },
  ];

  const mobileCard = (row: OverdueEntry) => (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900">{row.clientName}</span>
        <span className="inline-flex items-center gap-1 font-bold text-red-600">
          <AlertTriangle size={14} />
          {row.daysOverdue}d
        </span>
      </div>
      <div className="text-sm text-gray-500">GP# {row.gatePassNumber}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          {formatPaisaToRupees(row.amountPaisa)}
        </span>
        <span className="text-gray-500">
          Due: {formatDatePKT(row.dueDate)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Overdue Payments
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Payments past their due date
        </p>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        keyExtractor={(row) => `${row.clientId}-${row.gatePassNumber}`}
        mobileCard={mobileCard}
        emptyMessage="No overdue payments"
      />

      {/* Summary total row */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">
            Total Overdue ({entries.length} entries)
          </span>
          <span className="text-lg font-bold text-red-600">
            {formatPaisaToRupees(totalOverduePaisa)}
          </span>
        </div>
      )}
    </div>
  );
}
