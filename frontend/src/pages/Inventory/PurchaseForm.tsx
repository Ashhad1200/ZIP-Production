import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { CurrencyInput } from '../../components/forms/CurrencyInput';
import { formatDatePKT, toISODate } from '../../utils/date';
import { formatPaisaToRupees } from '../../utils/currency';
import { PAGINATION_DEFAULTS } from '../../utils/constants';
import {
  inventoryApi,
  type PurchaseRecord,
  type CreatePurchasePayload,
} from '../../services/inventory.api';

export function PurchaseForm() {
  const queryClient = useQueryClient();

  // ── List state ───────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [grainTypeFilter, setGrainTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);

  // ── Reference data ───────────────────────────────────────────────────────
  const { data: rawMaterialsResp } = useQuery({
    queryKey: ['raw-material-stock'],
    queryFn: inventoryApi.getRawMaterials,
  });
  const grainTypes = rawMaterialsResp?.data ?? [];

  // ── Purchases query ──────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: [
      'raw-material-purchases',
      page,
      grainTypeFilter,
      sourceFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      inventoryApi.getPurchases({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        grainTypeId: grainTypeFilter || undefined,
        source: sourceFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const purchases = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<PurchaseRecord>[] = [
    {
      key: 'purchaseDate',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.purchaseDate),
    },
    {
      key: 'grainType',
      header: 'Grain Type',
      sortable: true,
      render: (row) => row.grainType.name,
    },
    {
      key: 'numberOfBags',
      header: 'Bags',
      sortable: true,
      render: (row) => row.numberOfBags.toLocaleString(),
    },
    {
      key: 'ratePerBagPaisa',
      header: 'Rate/Bag',
      sortable: true,
      render: (row) =>
        row.ratePerBagDisplay || formatPaisaToRupees(row.ratePerBagPaisa),
    },
    {
      key: 'totalAmountPaisa',
      header: 'Total',
      sortable: true,
      render: (row) =>
        row.totalAmountDisplay || formatPaisaToRupees(row.totalAmountPaisa),
    },
    {
      key: 'source',
      header: 'Source',
      hideOnMobile: true,
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.source === 'CONTAINER'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {row.source === 'CONTAINER' ? 'Container' : 'Spot Market'}
        </span>
      ),
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: PurchaseRecord) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {formatDatePKT(row.purchaseDate)}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {row.totalAmountDisplay || formatPaisaToRupees(row.totalAmountPaisa)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{row.grainType.name}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.source === 'CONTAINER'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-orange-100 text-orange-800'
          }`}
        >
          {row.source === 'CONTAINER' ? 'Container' : 'Spot Market'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{row.numberOfBags} bags</span>
        <span>
          @ {row.ratePerBagDisplay || formatPaisaToRupees(row.ratePerBagPaisa)}/bag
        </span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Raw Material Purchases
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Track raw material procurement
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Purchase
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelect
          options={[
            { value: '', label: 'All Grain Types' },
            ...grainTypes.map((g) => ({
              value: g.grainType.id,
              label: g.grainType.name,
            })),
          ]}
          value={grainTypeFilter}
          onChange={(v) => {
            setGrainTypeFilter(v);
            setPage(1);
          }}
          placeholder="All Grain Types"
          clearable
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Sources' },
            { value: 'CONTAINER', label: 'Container' },
            { value: 'SPOT_MARKET', label: 'Spot Market' },
          ]}
          value={sourceFilter}
          onChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
          placeholder="All Sources"
          clearable
        />
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
          data={purchases}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No purchases recorded"
        />
      </div>

      {/* Create form modal */}
      {showForm && (
        <PurchaseFormModal
          grainTypes={grainTypes.map((g) => ({
            value: g.grainType.id,
            label: g.grainType.name,
          }))}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({
              queryKey: ['raw-material-purchases'],
            });
            queryClient.invalidateQueries({
              queryKey: ['raw-material-stock'],
            });
          }}
        />
      )}
    </div>
  );
}

// ─── Create purchase form modal ────────────────────────────────────────────

interface PurchaseFormModalProps {
  grainTypes: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

function PurchaseFormModal({
  grainTypes,
  onClose,
  onSuccess,
}: PurchaseFormModalProps) {
  const [grainTypeId, setGrainTypeId] = useState('');
  const [numberOfBags, setNumberOfBags] = useState('');
  const [ratePerBagPaisa, setRatePerBagPaisa] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(toISODate(new Date()));
  const [source, setSource] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const totalAmountPaisa =
    numberOfBags && ratePerBagPaisa
      ? Math.round(Number(numberOfBags) * ratePerBagPaisa)
      : 0;

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!grainTypeId) errs.grainTypeId = 'Grain type is required';
    if (!numberOfBags || Number(numberOfBags) <= 0)
      errs.numberOfBags = 'Enter valid number of bags';
    if (!ratePerBagPaisa || ratePerBagPaisa <= 0)
      errs.ratePerBagPaisa = 'Enter valid rate';
    if (!purchaseDate) errs.purchaseDate = 'Date is required';
    if (!source) errs.source = 'Source is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [grainTypeId, numberOfBags, ratePerBagPaisa, purchaseDate, source]);

  const mutation = useMutation({
    mutationFn: (payload: CreatePurchasePayload) =>
      inventoryApi.createPurchase(payload),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Purchase recorded!' });
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
      grainTypeId,
      numberOfBags: Number(numberOfBags),
      ratePerBagPaisa,
      purchaseDate,
      source: source as 'CONTAINER' | 'SPOT_MARKET',
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Modal open onClose={onClose} title="New Purchase" size="md">
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
        <SearchableSelect
          label="Grain Type"
          options={grainTypes}
          value={grainTypeId}
          onChange={setGrainTypeId}
          placeholder="Select grain type"
          error={errors.grainTypeId}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Number of Bags
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={numberOfBags}
            onChange={(e) => setNumberOfBags(e.target.value)}
            placeholder="0"
            min="0"
            step="any"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              errors.numberOfBags ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.numberOfBags && (
            <p className="mt-1 text-xs text-red-600">{errors.numberOfBags}</p>
          )}
        </div>

        <CurrencyInput
          label="Rate per Bag"
          value={ratePerBagPaisa}
          onChange={setRatePerBagPaisa}
          placeholder="e.g. 5000"
          error={errors.ratePerBagPaisa}
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

        <DatePicker
          label="Purchase Date"
          value={purchaseDate}
          onChange={setPurchaseDate}
          max={toISODate(new Date())}
          error={errors.purchaseDate}
        />

        <SearchableSelect
          label="Source"
          options={[
            { value: 'CONTAINER', label: 'Container' },
            { value: 'SPOT_MARKET', label: 'Spot Market' },
          ]}
          value={source}
          onChange={setSource}
          placeholder="Select source"
          error={errors.source}
        />

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
