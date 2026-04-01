import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type Variant, type GrainType } from '../../services/settings.api';

// ─── Variant Form ───────────────────────────────────────────────────────────

interface VariantFormProps {
  variant?: Variant | null;
  grainOptions: SelectOption[];
  onClose: () => void;
  onSuccess: () => void;
}

function VariantFormModal({ variant, grainOptions, onClose, onSuccess }: VariantFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!variant;

  const [code, setCode] = useState(variant?.code ?? '');
  const [name, setName] = useState(variant?.name ?? '');
  const [description, setDescription] = useState(variant?.description ?? '');
  const [standardGramsPerMeter, setStandardGramsPerMeter] = useState(
    String(variant?.standardGramsPerMeter ?? ''),
  );
  const [grainTypeId, setGrainTypeId] = useState(variant?.grainTypeId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Code is required';
    if (!name.trim()) errs.name = 'Name is required';
    if (!grainTypeId) errs.grainTypeId = 'Grain type is required';
    const gpm = Number(standardGramsPerMeter);
    if (isNaN(gpm) || gpm <= 0) errs.standardGramsPerMeter = 'Must be a positive number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [code, name, grainTypeId, standardGramsPerMeter]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createVariant({
        code: code.trim(),
        name: name.trim(),
        standardGramsPerMeter: Number(standardGramsPerMeter),
        grainTypeId,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-variants'] });
      setToast({ type: 'success', message: 'Variant created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create variant' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateVariant(variant!.id, {
        code: code.trim(),
        name: name.trim(),
        standardGramsPerMeter: Number(standardGramsPerMeter),
        grainTypeId,
        description: description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-variants'] });
      setToast({ type: 'success', message: 'Variant updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update variant' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Variant' : 'Create Variant'} size="md">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.code ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. V001"
            />
            {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Variant name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Standard g/m *
            </label>
            <input
              type="number"
              step="0.01"
              value={standardGramsPerMeter}
              onChange={(e) => setStandardGramsPerMeter(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.standardGramsPerMeter ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. 45.5"
            />
            {errors.standardGramsPerMeter && (
              <p className="mt-1 text-xs text-red-600">{errors.standardGramsPerMeter}</p>
            )}
          </div>
          <SearchableSelect
            label="Grain Type *"
            options={grainOptions}
            value={grainTypeId}
            onChange={setGrainTypeId}
            placeholder="Select grain type"
            error={errors.grainTypeId}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Optional description"
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
            disabled={isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />Saving…
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Create'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Grain Type Form ────────────────────────────────────────────────────────

interface GrainFormProps {
  grain?: GrainType | null;
  onClose: () => void;
  onSuccess: () => void;
}

function GrainTypeFormModal({ grain, onClose, onSuccess }: GrainFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!grain;

  const [code, setCode] = useState(grain?.code ?? '');
  const [name, setName] = useState(grain?.name ?? '');
  const [description, setDescription] = useState(grain?.description ?? '');
  const [bagWeightGrams, setBagWeightGrams] = useState(String(grain?.bagWeightGrams ?? ''));
  const [lowStockThresholdBags, setLowStockThresholdBags] = useState(
    grain?.lowStockThresholdBags != null ? String(grain.lowStockThresholdBags) : '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Code is required';
    if (!name.trim()) errs.name = 'Name is required';
    const bw = Number(bagWeightGrams);
    if (isNaN(bw) || bw <= 0) errs.bagWeightGrams = 'Must be a positive number';
    if (lowStockThresholdBags.trim()) {
      const th = Number(lowStockThresholdBags);
      if (isNaN(th) || th < 0)
        errs.lowStockThresholdBags = 'Must be zero or positive';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [code, name, bagWeightGrams, lowStockThresholdBags]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createGrainType({
        code: code.trim(),
        name: name.trim(),
        bagWeightGrams: Number(bagWeightGrams),
        lowStockThresholdBags: lowStockThresholdBags.trim()
          ? Number(lowStockThresholdBags)
          : undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-grain-types'] });
      setToast({ type: 'success', message: 'Grain type created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateGrainType(grain!.id, {
        code: code.trim(),
        name: name.trim(),
        bagWeightGrams: Number(bagWeightGrams),
        lowStockThresholdBags: lowStockThresholdBags.trim()
          ? Number(lowStockThresholdBags)
          : null,
        description: description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-grain-types'] });
      setToast({ type: 'success', message: 'Grain type updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Grain Type' : 'Create Grain Type'}
      size="md"
    >
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.code ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. GT01"
            />
            {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Grain type name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bag Weight (grams) *
            </label>
            <input
              type="number"
              value={bagWeightGrams}
              onChange={(e) => setBagWeightGrams(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.bagWeightGrams ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="e.g. 50000"
            />
            {errors.bagWeightGrams && (
              <p className="mt-1 text-xs text-red-600">{errors.bagWeightGrams}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Low Stock Threshold (bags)
            </label>
            <input
              type="number"
              value={lowStockThresholdBags}
              onChange={(e) => setLowStockThresholdBags(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.lowStockThresholdBags ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Optional"
            />
            {errors.lowStockThresholdBags && (
              <p className="mt-1 text-xs text-red-600">{errors.lowStockThresholdBags}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Optional description"
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
            disabled={isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />Saving…
              </>
            ) : isEdit ? (
              'Update'
            ) : (
              'Create'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

type ActiveTab = 'variants' | 'grains';

export function VariantGrainManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('variants');

  // Variants state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editVariant, setEditVariant] = useState<Variant | null>(null);

  // Grain state
  const [showGrainForm, setShowGrainForm] = useState(false);
  const [editGrain, setEditGrain] = useState<GrainType | null>(null);

  const { data: variantsResp, isLoading: loadingVariants } = useQuery({
    queryKey: ['settings-variants'],
    queryFn: settingsApi.getVariants,
  });

  const { data: grainsResp, isLoading: loadingGrains } = useQuery({
    queryKey: ['settings-grain-types'],
    queryFn: settingsApi.getGrainTypes,
  });

  const variants = variantsResp?.data ?? [];
  const grainTypes = grainsResp?.data ?? [];

  const grainOptions: SelectOption[] = grainTypes.map((g) => ({
    value: g.id,
    label: `${g.code} – ${g.name}`,
  }));

  // ── Variant columns ─────────────────────────────────────────────────────
  const variantColumns: Column<Variant>[] = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'standardGramsPerMeter',
      header: 'g/m',
      sortable: true,
      render: (row) => row.standardGramsPerMeter.toFixed(2),
    },
    {
      key: 'grainType',
      header: 'Grain Type',
      hideOnMobile: true,
      render: (row) =>
        row.grainType ? `${row.grainType.code} – ${row.grainType.name}` : '—',
    },
    {
      key: 'isActive',
      header: 'Status',
      hideOnMobile: true,
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
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
            setEditVariant(row);
          }}
          className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          Edit
        </button>
      ),
    },
  ];

  const variantMobileCard = (row: Variant) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {row.code} – {row.name}
        </span>
        <button
          onClick={() => setEditVariant(row)}
          className="min-h-[44px] text-xs text-blue-600"
        >
          Edit
        </button>
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>{row.standardGramsPerMeter.toFixed(2)} g/m</span>
        <span>{row.grainType?.name ?? '—'}</span>
      </div>
    </div>
  );

  // ── Grain Type columns ──────────────────────────────────────────────────
  const grainColumns: Column<GrainType>[] = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'bagWeightGrams',
      header: 'Bag Weight (g)',
      sortable: true,
      render: (row) => row.bagWeightGrams.toLocaleString(),
    },
    {
      key: 'lowStockThresholdBags',
      header: 'Threshold',
      hideOnMobile: true,
      render: (row) =>
        row.lowStockThresholdBags != null
          ? `${row.lowStockThresholdBags} bags`
          : '—',
    },
    {
      key: 'isActive',
      header: 'Status',
      hideOnMobile: true,
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
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
            setEditGrain(row);
          }}
          className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          Edit
        </button>
      ),
    },
  ];

  const grainMobileCard = (row: GrainType) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {row.code} – {row.name}
        </span>
        <button
          onClick={() => setEditGrain(row)}
          className="min-h-[44px] text-xs text-blue-600"
        >
          Edit
        </button>
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>{row.bagWeightGrams.toLocaleString()} g/bag</span>
        {row.lowStockThresholdBags != null && (
          <span>Threshold: {row.lowStockThresholdBags}</span>
        )}
      </div>
    </div>
  );

  const isLoading = loadingVariants || loadingGrains;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              Variants & Grain Types
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage product variants and grain type definitions
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            activeTab === 'variants'
              ? setShowVariantForm(true)
              : setShowGrainForm(true)
          }
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          {activeTab === 'variants' ? 'Add Variant' : 'Add Grain Type'}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('variants')}
          className={`min-h-[44px] flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'variants'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Variants ({variants.length})
        </button>
        <button
          onClick={() => setActiveTab('grains')}
          className={`min-h-[44px] flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'grains'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Grain Types ({grainTypes.length})
        </button>
      </div>

      {/* Content */}
      <div className="rounded-lg border bg-white">
        {activeTab === 'variants' ? (
          <DataTable
            columns={variantColumns}
            data={variants}
            isLoading={loadingVariants}
            keyExtractor={(row) => row.id}
            mobileCard={variantMobileCard}
            emptyMessage="No variants configured"
          />
        ) : (
          <DataTable
            columns={grainColumns}
            data={grainTypes}
            isLoading={loadingGrains}
            keyExtractor={(row) => row.id}
            mobileCard={grainMobileCard}
            emptyMessage="No grain types configured"
          />
        )}
      </div>

      {/* Variant modals */}
      {showVariantForm && (
        <VariantFormModal
          grainOptions={grainOptions}
          onClose={() => setShowVariantForm(false)}
          onSuccess={() => setShowVariantForm(false)}
        />
      )}
      {editVariant && (
        <VariantFormModal
          variant={editVariant}
          grainOptions={grainOptions}
          onClose={() => setEditVariant(null)}
          onSuccess={() => setEditVariant(null)}
        />
      )}

      {/* Grain Type modals */}
      {showGrainForm && (
        <GrainTypeFormModal
          onClose={() => setShowGrainForm(false)}
          onSuccess={() => setShowGrainForm(false)}
        />
      )}
      {editGrain && (
        <GrainTypeFormModal
          grain={editGrain}
          onClose={() => setEditGrain(null)}
          onSuccess={() => setEditGrain(null)}
        />
      )}
    </div>
  );
}
