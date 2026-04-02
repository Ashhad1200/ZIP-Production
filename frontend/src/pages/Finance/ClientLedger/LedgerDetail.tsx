import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column, KPICard } from '../../../components/ui';
import { DatePicker, SearchableSelect } from '../../../components/forms';
import { useSmartQuery } from '../../../hooks/useSmartQuery';
import {
  financeApi,
  type LedgerEntry,
} from '../../../services/finance.api';
import { formatDatePKT } from '../../../utils/date';
import { POLLING_INTERVALS, PAGINATION_DEFAULTS } from '../../../utils/constants';
import { PaymentForm } from './PaymentForm';

export function LedgerDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const { data, isLoading } = useSmartQuery({
    queryKey: ['client-ledger', clientId, page, dateFrom, dateTo, typeFilter],
    queryFn: () =>
      financeApi.getClientLedger(clientId!, {
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        type: (typeFilter as 'DEBIT' | 'CREDIT') || undefined,
      }),
    pollingInterval: POLLING_INTERVALS.FINANCE,
    enabled: !!clientId,
  });

  const ledger = data?.data;
  const entries = ledger?.entries ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  const handleDownload = async (format: 'pdf' | 'csv') => {
    if (!clientId) return;
    try {
      const response = await financeApi.downloadLedger(clientId, format);
      const blob = new Blob([response.data as BlobPart]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${clientId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Download error silently handled
    }
    setShowDownloadMenu(false);
  };

  const columns: Column<LedgerEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.date),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.type === 'DEBIT'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div>
          <span className="text-gray-900">{row.description}</span>
          {row.gatePassNumber && (
            <span className="ml-2 text-xs text-gray-500">
              GP# {row.gatePassNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className="font-medium">
          {row.amountDisplay}
        </span>
      ),
    },
    {
      key: 'runningBalance',
      header: 'Balance',
      hideOnMobile: true,
      render: (row) => row.runningBalanceDisplay,
    },
    {
      key: 'overdue',
      header: 'Status',
      hideOnMobile: true,
      render: (row) =>
        row.isOverdue && row.daysOverdue ? (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {row.daysOverdue}d overdue
          </span>
        ) : null,
    },
  ];

  const mobileCard = (row: LedgerEntry) => (
    <div
      className={`space-y-2 rounded-lg border p-4 ${
        row.isOverdue ? 'border-red-200 bg-red-50' : 'bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{formatDatePKT(row.date)}</span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            row.type === 'DEBIT'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {row.type}
        </span>
      </div>
      <p className="text-sm text-gray-900">{row.description}</p>
      {row.gatePassNumber && (
        <p className="text-xs text-gray-500">GP# {row.gatePassNumber}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {row.amountDisplay}
        </span>
        {row.isOverdue && row.daysOverdue && (
          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {row.daysOverdue}d overdue
          </span>
        )}
      </div>
    </div>
  );

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'DEBIT', label: 'Debit' },
    { value: 'CREDIT', label: 'Credit' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/finance/client-ledger')}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              {ledger?.client?.name ?? 'Client Ledger'}
            </h1>
            {ledger?.client && (
              <p className="text-sm text-gray-500">
                Payment cycle: {ledger.client.paymentCycleDays} days
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Download
            </button>
            {showDownloadMenu && (
              <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border bg-white py-1 shadow-lg">
                <button
                  onClick={() => handleDownload('pdf')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  PDF
                </button>
                <button
                  onClick={() => handleDownload('csv')}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  CSV
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(`/finance/client-ledger/${clientId}/rates`)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Rates
          </button>
          <button
            onClick={() => setShowPaymentForm(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <CreditCard size={16} />
            Record Payment
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {ledger?.summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KPICard
            title="Total Debits"
            value={ledger.summary.totalDebitsDisplay}
            icon={<TrendingUp className="text-green-600" size={20} />}
          />
          <KPICard
            title="Total Credits"
            value={ledger.summary.totalCreditsDisplay}
            icon={<TrendingDown className="text-blue-600" size={20} />}
          />
          <KPICard
            title="Outstanding"
            value={ledger.summary.outstandingDisplay}
            icon={<Wallet className="text-red-600" size={20} />}
            className={
              Number(ledger.summary.outstanding) > 0
                ? 'border-red-200 bg-red-50'
                : ''
            }
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <DatePicker
          label="From"
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            setPage(PAGINATION_DEFAULTS.PAGE);
          }}
        />
        <DatePicker
          label="To"
          value={dateTo}
          onChange={(v) => {
            setDateTo(v);
            setPage(PAGINATION_DEFAULTS.PAGE);
          }}
        />
        <div className="min-w-[150px]">
          <SearchableSelect
            label="Type"
            options={typeOptions}
            value={typeFilter}
            onChange={(v) => {
              setTypeFilter(v);
              setPage(PAGINATION_DEFAULTS.PAGE);
            }}
            placeholder="All Types"
            clearable
          />
        </div>
      </div>

      {/* Ledger Table */}
      <DataTable
        columns={columns}
        data={entries}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        keyExtractor={(row) => row.id}
        mobileCard={mobileCard}
        emptyMessage="No ledger entries found"
      />

      {/* Payment Form Modal */}
      {showPaymentForm && clientId && (
        <PaymentForm
          clientId={clientId}
          clientName={ledger?.client?.name ?? ''}
          currentOutstanding={Number(ledger?.summary?.outstanding ?? 0)}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={() => {
            setShowPaymentForm(false);
            queryClient.invalidateQueries({
              queryKey: ['client-ledger', clientId],
            });
          }}
        />
      )}
    </div>
  );
}
