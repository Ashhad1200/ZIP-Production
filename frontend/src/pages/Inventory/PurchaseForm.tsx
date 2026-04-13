import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Package, Wheat } from 'lucide-react';
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
  packagingApi,
  type PurchaseRecord,
  type CreatePurchasePayload,
  type PackagingMaterial,
  type PackagingAdjustment,
} from '../../services/inventory.api';
import { settingsApi } from '../../services/settings.api';

type PurchaseTab = 'seeds' | 'packaging';

export function PurchaseForm() {
  const [activeTab, setActiveTab] = useState<PurchaseTab>('seeds');

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Raw Material Purchases
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Track seed and packaging procurement
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex border-b">
        <button
          onClick={() => setActiveTab('seeds')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'seeds'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wheat size={16} />
          Seeds / Grains
        </button>
        <button
          onClick={() => setActiveTab('packaging')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'packaging'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package size={16} />
          Packaging
        </button>
      </div>

      {activeTab === 'seeds' ? <SeedPurchases /> : <PackagingPurchases />}
    </div>
  );
}

// ─── Seed Purchases ─────────────────────────────────────────────────────────

function SeedPurchases() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [grainTypeFilter, setGrainTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: rawMaterialsResp } = useQuery({
    queryKey: ['raw-material-stock'],
    queryFn: inventoryApi.getRawMaterials,
  });
  const grainTypes = rawMaterialsResp?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['raw-material-purchases', page, grainTypeFilter, sourceFilter, dateFrom, dateTo],
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
      key: 'vendor',
      header: 'Vendor',
      hideOnMobile: true,
      render: (row) => row.vendor?.name ?? <span className="text-gray-400">—</span>,
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
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Seed Purchase
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
          onChange={(v) => { setGrainTypeFilter(v); setPage(1); }}
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
          onChange={(v) => { setSourceFilter(v); setPage(1); }}
          placeholder="All Sources"
          clearable
        />
        <DatePicker label="From" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} />
        <DatePicker label="To" value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} />
      </div>

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
          emptyMessage="No seed purchases recorded"
        />
      </div>

      {showForm && (
        <SeedPurchaseFormModal
          grainTypes={grainTypes.map((g) => ({
            value: g.grainType.id,
            label: g.grainType.name,
          }))}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['raw-material-purchases'] });
            queryClient.invalidateQueries({ queryKey: ['raw-material-stock'] });
          }}
        />
      )}
    </>
  );
}

// ─── Packaging Purchases ────────────────────────────────────────────────────

function PackagingPurchases() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: materialsResp } = useQuery({
    queryKey: ['packaging-materials'],
    queryFn: packagingApi.listMaterials,
  });
  const materials = materialsResp?.data ?? [];

  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  const { data: adjustmentsResp, isLoading: loadingAdjustments } = useQuery({
    queryKey: ['packaging-purchases', selectedMaterialId],
    queryFn: () => packagingApi.listAdjustments(selectedMaterialId),
    enabled: !!selectedMaterialId,
  });

  // Show purchase-type adjustments for all materials or filtered
  const allPurchases = (adjustmentsResp?.data ?? []).filter(
    (a) => a.type === 'PURCHASE'
  );

  const columns: Column<PackagingAdjustment>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.purchaseDate || row.createdAt),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      hideOnMobile: true,
      render: (row) => row.vendor?.name ?? <span className="text-gray-400">—</span>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      sortable: true,
      render: (row) => row.quantity.toLocaleString(),
    },
    {
      key: 'unitRatePaisa',
      header: 'Rate/Unit',
      sortable: true,
      render: (row) =>
        row.unitRatePaisa != null ? formatPaisaToRupees(row.unitRatePaisa) : '—',
    },
    {
      key: 'totalCostPaisa',
      header: 'Total',
      sortable: true,
      render: (row) =>
        row.totalCostPaisa != null ? formatPaisaToRupees(row.totalCostPaisa) : '—',
    },
    {
      key: 'notes',
      header: 'Notes',
      hideOnMobile: true,
      render: (row) => row.notes || <span className="text-gray-400">—</span>,
    },
  ];

  const mobileCard = (row: PackagingAdjustment) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {formatDatePKT(row.purchaseDate || row.createdAt)}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {row.totalCostPaisa != null ? formatPaisaToRupees(row.totalCostPaisa) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{row.vendor?.name ?? 'No vendor'}</span>
        <span>{row.quantity} units</span>
      </div>
      {row.unitRatePaisa != null && (
        <div className="text-xs text-gray-500">
          @ {formatPaisaToRupees(row.unitRatePaisa)}/unit
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={[
              { value: '', label: 'Select Packaging Material' },
              ...materials.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.currentStock} ${m.unit})`,
              })),
            ]}
            value={selectedMaterialId}
            onChange={setSelectedMaterialId}
            placeholder="Select packaging material..."
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Packaging Purchase
        </button>
      </div>

      {!selectedMaterialId ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">
          Select a packaging material above to view purchase history
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <DataTable
            columns={columns}
            data={allPurchases}
            isLoading={loadingAdjustments}
            keyExtractor={(row) => row.id}
            mobileCard={mobileCard}
            emptyMessage="No packaging purchases recorded for this material"
          />
        </div>
      )}

      {showForm && (
        <PackagingPurchaseFormModal
          materials={materials}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['packaging-purchases'] });
            queryClient.invalidateQueries({ queryKey: ['packaging-materials'] });
          }}
        />
      )}
    </>
  );
}

// ─── Seed Purchase Form Modal ───────────────────────────────────────────────

interface SeedPurchaseFormModalProps {
  grainTypes: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

function SeedPurchaseFormModal({
  grainTypes,
  onClose,
  onSuccess,
}: SeedPurchaseFormModalProps) {
  const [grainTypeId, setGrainTypeId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [numberOfBags, setNumberOfBags] = useState('');
  const [ratePerBagPaisa, setRatePerBagPaisa] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(toISODate(new Date()));
  const [source, setSource] = useState('');

  const { data: vendorsResp } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => settingsApi.getVendors(false),
  });
  const vendors = vendorsResp?.data ?? [];
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
      vendorId: vendorId || undefined,
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
    <Modal open onClose={onClose} title="New Seed Purchase" size="md">
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

        <SearchableSelect
          label="Vendor (optional)"
          options={[
            { value: '', label: 'No vendor / unspecified' },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
          value={vendorId}
          onChange={setVendorId}
          placeholder="Select vendor"
          clearable
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

// ─── Packaging Purchase Form Modal ──────────────────────────────────────────

interface PackagingPurchaseFormModalProps {
  materials: PackagingMaterial[];
  onClose: () => void;
  onSuccess: () => void;
}

function PackagingPurchaseFormModal({
  materials,
  onClose,
  onSuccess,
}: PackagingPurchaseFormModalProps) {
  const [materialId, setMaterialId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [ratePerUnitPaisa, setRatePerUnitPaisa] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: vendorsResp } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => settingsApi.getVendors(false),
  });
  const vendors = vendorsResp?.data ?? [];

  // Pre-fill rate from selected material
  useEffect(() => {
    if (materialId) {
      const m = materials.find((mat) => mat.id === materialId);
      if (m && m.ratePerUnitPaisa > 0) {
        setRatePerUnitPaisa(m.ratePerUnitPaisa);
      }
    }
  }, [materialId, materials]);

  const totalAmountPaisa =
    quantity && ratePerUnitPaisa
      ? Math.round(Number(quantity) * ratePerUnitPaisa)
      : 0;

  const selectedMaterial = materials.find((m) => m.id === materialId);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!materialId) errs.materialId = 'Material is required';
    if (!quantity || Number(quantity) <= 0)
      errs.quantity = 'Enter valid quantity';
    if (!ratePerUnitPaisa || ratePerUnitPaisa <= 0)
      errs.ratePerUnitPaisa = 'Enter valid rate';
    if (!purchaseDate) errs.purchaseDate = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [materialId, quantity, ratePerUnitPaisa, purchaseDate]);

  const mutation = useMutation({
    mutationFn: (data: { materialId: string; quantity: number; type: string; vendorId?: string; purchaseDate?: string; ratePerUnitPaisa?: number; notes?: string }) =>
      packagingApi.recordAdjustment(data.materialId, {
        quantity: data.quantity,
        type: data.type,
        vendorId: data.vendorId,
        purchaseDate: data.purchaseDate,
        ratePerUnitPaisa: data.ratePerUnitPaisa,
        notes: data.notes,
      }),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Packaging purchase recorded!' });
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
      materialId,
      quantity: Number(quantity),
      type: 'PURCHASE',
      vendorId: vendorId || undefined,
      purchaseDate: purchaseDate || undefined,
      ratePerUnitPaisa,
      notes: notes || undefined,
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Modal open onClose={onClose} title="New Packaging Purchase" size="md">
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
          label="Packaging Material"
          options={materials.map((m) => ({
            value: m.id,
            label: `${m.name} (${m.unit})`,
          }))}
          value={materialId}
          onChange={setMaterialId}
          placeholder="Select material"
          error={errors.materialId}
        />

        {selectedMaterial && (
          <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            Current stock: <span className="font-medium">{selectedMaterial.currentStock}</span> {selectedMaterial.unit}
          </div>
        )}

        <SearchableSelect
          label="Vendor (optional)"
          options={[
            { value: '', label: 'No vendor / unspecified' },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
          value={vendorId}
          onChange={setVendorId}
          placeholder="Select vendor"
          clearable
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quantity ({selectedMaterial?.unit || 'units'})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            min="1"
            step="1"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              errors.quantity ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.quantity && (
            <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>
          )}
        </div>

        <CurrencyInput
          label={`Rate per ${selectedMaterial?.unit || 'unit'}`}
          value={ratePerUnitPaisa}
          onChange={setRatePerUnitPaisa}
          placeholder="e.g. 500"
          error={errors.ratePerUnitPaisa}
        />

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

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Invoice #123"
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
