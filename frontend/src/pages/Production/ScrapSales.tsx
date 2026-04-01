import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, TrendingUp } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { DatePicker } from '../../components/forms/DatePicker';
import { CurrencyInput } from '../../components/forms/CurrencyInput';
import { formatDatePKT, toISODate } from '../../utils/date';
import { formatPaisaToRupees } from '../../utils/currency';
import { PAGINATION_DEFAULTS } from '../../utils/constants';
import {
  productionApi,
  type ScrapSale,
  type CreateScrapSalePayload,
  type ScrapMonthlySummary,
} from '../../services/production.api';

export function ScrapSales() {
  const queryClient = useQueryClient();

  // ── List state ───────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['scrap-sales', page, dateFrom, dateTo],
    queryFn: () =>
      productionApi.getScrapSales({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const { data: monthlySummaryResp } = useQuery({
    queryKey: ['scrap-sales-monthly'],
    queryFn: productionApi.getScrapMonthlySummary,
  });
  const monthlySummary: ScrapMonthlySummary[] = monthlySummaryResp?.data ?? [];

  const sales = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<ScrapSale>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.date),
    },
    {
      key: 'totalWeightKg',
      header: 'Weight (kg)',
      sortable: true,
      render: (row) => row.totalWeightKg.toLocaleString(),
    },
    {
      key: 'ratePerKgPaisa',
      header: 'Rate/kg',
      sortable: true,
      render: (row) => formatPaisaToRupees(row.ratePerKgPaisa),
    },
    {
      key: 'totalAmountPaisa',
      header: 'Total',
      sortable: true,
      render: (row) => row.totalAmountDisplay || formatPaisaToRupees(row.totalAmountPaisa),
    },
    {
      key: 'buyerName',
      header: 'Buyer',
      hideOnMobile: true,
      render: (row) => row.buyerName || '—',
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: ScrapSale) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {formatDatePKT(row.date)}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {row.totalAmountDisplay || formatPaisaToRupees(row.totalAmountPaisa)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{row.totalWeightKg} kg @ {formatPaisaToRupees(row.ratePerKgPaisa)}/kg</span>
        {row.buyerName && <span>{row.buyerName}</span>}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Scrap Sales
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Track scrap material sales
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSummary(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <TrendingUp size={16} />
            Monthly Summary
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Sale
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <DatePicker
          label="From"
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            setPage(1);
          }}
        />
        <DatePicker
          label="To"
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
          data={sales}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No scrap sales recorded"
        />
      </div>

      {/* Create form modal */}
      {showForm && (
        <ScrapSaleFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['scrap-sales'] });
            queryClient.invalidateQueries({
              queryKey: ['scrap-sales-monthly'],
            });
          }}
        />
      )}

      {/* Monthly summary modal */}
      {showSummary && (
        <MonthlySummaryModal
          data={monthlySummary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

// ─── Create scrap sale form modal ──────────────────────────────────────────

interface ScrapSaleFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function ScrapSaleFormModal({ onClose, onSuccess }: ScrapSaleFormModalProps) {
  const [date, setDate] = useState(toISODate(new Date()));
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [ratePerKgPaisa, setRatePerKgPaisa] = useState(0);
  const [buyerName, setBuyerName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const totalAmountPaisa =
    totalWeightKg && ratePerKgPaisa
      ? Math.round(Number(totalWeightKg) * ratePerKgPaisa)
      : 0;

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Date is required';
    if (!totalWeightKg || Number(totalWeightKg) <= 0)
      errs.totalWeightKg = 'Enter valid weight';
    if (!ratePerKgPaisa || ratePerKgPaisa <= 0)
      errs.ratePerKgPaisa = 'Enter valid rate';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [date, totalWeightKg, ratePerKgPaisa]);

  const mutation = useMutation({
    mutationFn: (payload: CreateScrapSalePayload) =>
      productionApi.createScrapSale(payload),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Scrap sale recorded!' });
      setTimeout(onSuccess, 800);
    },
    onError: (err: Error) => {
      setToast({
        type: 'error',
        message: err.message || 'Failed to save',
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      date,
      totalWeightKg: Number(totalWeightKg),
      ratePerKgPaisa,
      buyerName: buyerName.trim() || undefined,
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Modal open onClose={onClose} title="New Scrap Sale" size="md">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <DatePicker
          label="Sale Date"
          value={date}
          onChange={setDate}
          max={toISODate(new Date())}
          error={errors.date}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Weight (kg)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={totalWeightKg}
            onChange={(e) => setTotalWeightKg(e.target.value)}
            placeholder="0"
            min="0"
            step="any"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              errors.totalWeightKg ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.totalWeightKg && (
            <p className="mt-1 text-xs text-red-600">{errors.totalWeightKg}</p>
          )}
        </div>

        <CurrencyInput
          label="Rate per kg"
          value={ratePerKgPaisa}
          onChange={setRatePerKgPaisa}
          placeholder="e.g. 150"
          error={errors.ratePerKgPaisa}
        />

        {/* Auto-calculated total */}
        {totalAmountPaisa > 0 && (
          <div className="rounded-lg bg-green-50 px-4 py-3">
            <span className="text-sm text-green-700">Total: </span>
            <span className="text-sm font-bold text-green-900">
              {formatPaisaToRupees(totalAmountPaisa)}
            </span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Buyer Name{' '}
            <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Enter buyer name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Monthly summary modal ─────────────────────────────────────────────────

interface MonthlySummaryModalProps {
  data: ScrapMonthlySummary[];
  onClose: () => void;
}

function MonthlySummaryModal({ data, onClose }: MonthlySummaryModalProps) {
  return (
    <Modal open onClose={onClose} title="Monthly Scrap Summary" size="md">
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No summary data available
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Weight (kg)</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.month}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.count}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.totalWeightKg.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatPaisaToRupees(row.totalPaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
