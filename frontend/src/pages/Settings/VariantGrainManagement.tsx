import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type Variant, type GrainType, type Recipe } from '../../services/settings.api';
import { packagingApi } from '../../services/inventory.api';
import { formatPaisaToRupees } from '../../utils/currency';

// ─── Variant Form ───────────────────────────────────────────────────────────

interface IngredientRow {
  grainTypeId: string;
  ratioPercent: string; // string for input binding
}

interface VariantFormProps {
  variant?: Variant | null;
  grainOptions: SelectOption[];
  packagingOptions: SelectOption[];
  recipes: Recipe[];
  onClose: () => void;
  onSuccess: () => void;
}

function VariantFormModal({ variant, grainOptions, packagingOptions, recipes, onClose, onSuccess }: VariantFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!variant;

  const [code, setCode] = useState(variant?.code ?? '');
  const [name, setName] = useState(variant?.name ?? '');
  const [description, setDescription] = useState(variant?.description ?? '');
  const [standardGramsPerMeter, setStandardGramsPerMeter] = useState(
    String(variant?.standardGramsPerMeter ?? ''),
  );
  const [metersPerCarton, setMetersPerCarton] = useState(
    variant?.metersPerCarton != null ? String(variant.metersPerCarton) : '',
  );
  const [packagingMaterialId, setPackagingMaterialId] = useState(
    variant?.packagingMaterialId ?? '',
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState(variant?.recipeId ?? '');
  const usingRecipe = !!selectedRecipeId;

  // Ingredient rows — pre-fill from existing variant
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() => {
    if (variant?.ingredients && variant.ingredients.length > 0) {
      return variant.ingredients.map((i) => ({
        grainTypeId: i.grainTypeId,
        ratioPercent: String(i.ratioPercent),
      }));
    }
    if (variant?.grainTypeId) {
      return [{ grainTypeId: variant.grainTypeId, ratioPercent: '100' }];
    }
    return [{ grainTypeId: '', ratioPercent: '100' }];
  });

  const recipeOptions: SelectOption[] = recipes.filter((r) => r.isActive).map((r) => ({
    value: r.id,
    label: `${r.name} — ${r.ingredients.map((i) => `${i.grainType.code} ${Number(i.ratioPercent)}%`).join(' + ')}`,
  }));

  const handleRecipeChange = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (recipeId) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (recipe) {
        setIngredients(recipe.ingredients.map((i) => ({
          grainTypeId: i.grainTypeId,
          ratioPercent: String(Number(i.ratioPercent)),
        })));
      }
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { grainTypeId: '', ratioPercent: '' }]);

  const removeIngredient = (idx: number) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) =>
    setIngredients((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const totalRatio = ingredients.reduce((s, i) => s + (Number(i.ratioPercent) || 0), 0);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = 'Code is required';
    if (!name.trim()) errs.name = 'Name is required';
    const gpm = Number(standardGramsPerMeter);
    if (isNaN(gpm) || gpm <= 0) errs.standardGramsPerMeter = 'Must be a positive number';
    if (ingredients.length === 0) errs.ingredients = 'At least one seed ingredient is required';
    if (ingredients.some((i) => !i.grainTypeId)) errs.ingredients = 'Select a seed for every ingredient row';
    const uniqueGrains = new Set(ingredients.map((i) => i.grainTypeId));
    if (uniqueGrains.size < ingredients.length) errs.ingredients = 'Each seed type can only appear once';
    if (Math.abs(totalRatio - 100) > 0.01) errs.ingredients = `Ratios must sum to 100% (currently ${totalRatio.toFixed(1)}%)`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [code, name, standardGramsPerMeter, ingredients, totalRatio]);

  const parsedIngredients = () =>
    ingredients.map((i) => ({ grainTypeId: i.grainTypeId, ratioPercent: Number(i.ratioPercent) }));

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createVariant({
        code: code.trim(),
        name: name.trim(),
        standardGramsPerMeter: Number(standardGramsPerMeter),
        metersPerCarton: metersPerCarton ? Number(metersPerCarton) : undefined,
        packagingMaterialId: packagingMaterialId || undefined,
        recipeId: selectedRecipeId || undefined,
        ingredients: usingRecipe ? undefined : parsedIngredients(),
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
        name: name.trim(),
        standardGramsPerMeter: Number(standardGramsPerMeter),
        metersPerCarton: metersPerCarton ? Number(metersPerCarton) : null,
        packagingMaterialId: packagingMaterialId || null,
        recipeId: selectedRecipeId || null,
        ingredients: usingRecipe ? undefined : parsedIngredients(),
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
              disabled={isEdit}
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

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Standard g/m *</label>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Meters per Carton</label>
          <input
            type="number"
            min={1}
            value={metersPerCarton}
            onChange={(e) => setMetersPerCarton(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 200 (optional)"
          />
          <p className="mt-1 text-xs text-gray-500">Used to convert finished goods stock to carton counts on gate passes</p>
        </div>

        <div>
          <SearchableSelect
            label="Packaging Material"
            options={packagingOptions}
            value={packagingMaterialId}
            onChange={setPackagingMaterialId}
            placeholder="Select packaging item used for this variant"
            clearable
          />
          <p className="mt-1 text-xs text-gray-500">
            Used for automatic packaging deduction when production is completed.
          </p>
        </div>

        {/* Recipe Dropdown */}
        <div>
          <SearchableSelect
            label="Recipe / Formula"
            options={recipeOptions}
            value={selectedRecipeId}
            onChange={handleRecipeChange}
            placeholder="Select a recipe to auto-fill ingredients…"
            clearable
          />
          <p className="mt-1 text-xs text-gray-500">
            Select a recipe to auto-fill seed ingredients. Leave empty for manual ingredient entry.
          </p>
        </div>

        {/* ── Seed Ingredients ── */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Seed Ingredients {!usingRecipe && '*'}
              {usingRecipe && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                  <FlaskConical size={12} /> From recipe
                </span>
              )}
              <span className={`ml-2 text-xs font-normal ${Math.abs(totalRatio - 100) < 0.01 ? 'text-green-600' : 'text-orange-500'}`}>
                Total: {totalRatio.toFixed(1)}%{Math.abs(totalRatio - 100) < 0.01 ? ' ✓' : ' (must be 100%)'}
              </span>
            </label>
            {!usingRecipe && (
              <button
                type="button"
                onClick={addIngredient}
                className="flex items-center gap-1 rounded-lg border border-dashed border-blue-400 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                <Plus size={12} /> Add Seed
              </button>
            )}
          </div>

          <div className={`space-y-2 ${usingRecipe ? 'opacity-75' : ''}`}>
            {ingredients.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    label=""
                    options={grainOptions}
                    value={row.grainTypeId}
                    onChange={(v) => updateIngredient(idx, 'grainTypeId', v)}
                    placeholder="Select seed type"
                    disabled={usingRecipe}
                  />
                </div>
                <div className="w-28 flex-shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={100}
                      value={row.ratioPercent}
                      onChange={(e) => updateIngredient(idx, 'ratioPercent', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-6 text-sm disabled:bg-gray-50"
                      placeholder="100"
                      disabled={usingRecipe}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
                {!usingRecipe && ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="flex-shrink-0 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.ingredients && <p className="mt-1 text-xs text-red-600">{errors.ingredients}</p>}
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

  const { data: packagingResp, isLoading: loadingPackaging } = useQuery({
    queryKey: ['packaging-materials'],
    queryFn: packagingApi.listMaterials,
  });

  const { data: recipesResp } = useQuery({
    queryKey: ['recipes'],
    queryFn: settingsApi.getRecipes,
  });

  const variants = variantsResp?.data ?? [];
  const grainTypes = grainsResp?.data ?? [];
  const packagingMaterials = packagingResp?.data ?? [];
  const recipes = recipesResp?.data ?? [];

  const grainOptions: SelectOption[] = grainTypes.map((g) => ({
    value: g.id,
    label: `${g.code} – ${g.name}`,
  }));

  const packagingOptions: SelectOption[] = packagingMaterials.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.unit}) — ${formatPaisaToRupees(m.ratePerUnitPaisa)}/${m.unit}`,
  }));

  // ── Variant columns ─────────────────────────────────────────────────────
  const variantColumns: Column<Variant>[] = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'standardGramsPerMeter',
      header: 'g/m',
      sortable: true,
      render: (row) => Number(row.standardGramsPerMeter).toFixed(2),
    },
    {
      key: 'grainType',
      header: 'Seed Mix',
      hideOnMobile: true,
      render: (row) => {
        if (row.ingredients && row.ingredients.length > 0) {
          return (
            <div>
              {row.recipe && (
                <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                  <FlaskConical size={10} /> {row.recipe.name}
                </span>
              )}
              <div className="text-xs text-gray-700">
                {row.ingredients.map((i) => `${i.grainType.name} ${Number(i.ratioPercent).toFixed(0)}%`).join(' + ')}
              </div>
            </div>
          );
        }
        return row.grainType ? `${row.grainType.code} – ${row.grainType.name}` : '—';
      },
    },
    {
      key: 'packagingMaterialId',
      header: 'Packaging',
      hideOnMobile: true,
      render: (row) =>
        row.packagingMaterial
          ? `${row.packagingMaterial.name} (${row.packagingMaterial.unit})`
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
        <span>{Number(row.standardGramsPerMeter).toFixed(2)} g/m</span>
        <span>
          {row.ingredients && row.ingredients.length > 0
            ? row.ingredients.map((i) => `${i.grainType.name} ${Number(i.ratioPercent).toFixed(0)}%`).join(' + ')
            : row.grainType?.name ?? '—'}
        </span>
      </div>
      {row.packagingMaterial && (
        <div className="text-xs text-gray-500">
          Packaging: {row.packagingMaterial.name} ({row.packagingMaterial.unit})
        </div>
      )}
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

  const isLoading = loadingVariants || loadingGrains || loadingPackaging;

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
          packagingOptions={packagingOptions}
          recipes={recipes}
          onClose={() => setShowVariantForm(false)}
          onSuccess={() => setShowVariantForm(false)}
        />
      )}
      {editVariant && (
        <VariantFormModal
          variant={editVariant}
          grainOptions={grainOptions}
          packagingOptions={packagingOptions}
          recipes={recipes}
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
