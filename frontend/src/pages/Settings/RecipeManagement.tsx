import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2,
  FlaskConical,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type Recipe, type RawMaterialType } from '../../services/settings.api';

// ─── Ingredient Row ─────────────────────────────────────────────────────────

interface IngredientRow {
  rawMaterialTypeId: string;
  ratioPercent: string;
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface RecipeFormModalProps {
  recipe?: Recipe | null;
  rawMaterialTypes: RawMaterialType[];
  onClose: () => void;
  onSuccess: () => void;
}

function RecipeFormModal({ recipe, rawMaterialTypes, onClose, onSuccess }: RecipeFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!recipe;

  const [name, setName] = useState(recipe?.name ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe?.ingredients.map((i) => ({
      rawMaterialTypeId: i.rawMaterialTypeId,
      ratioPercent: String(Number(i.ratioPercent)),
    })) ?? [{ rawMaterialTypeId: '', ratioPercent: '' }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const grainOptions: SelectOption[] = rawMaterialTypes.map((g) => ({
    value: g.id,
    label: `${g.code} — ${g.name}`,
  }));

  const totalRatio = ingredients.reduce((s, i) => s + (parseFloat(i.ratioPercent) || 0), 0);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Recipe name is required';
    if (ingredients.length === 0) errs.ingredients = 'At least one ingredient is required';
    const hasEmpty = ingredients.some((i) => !i.rawMaterialTypeId || !i.ratioPercent);
    if (hasEmpty) errs.ingredients = 'All ingredients must have a raw material type and ratio';
    if (Math.abs(totalRatio - 100) > 0.01) errs.total = `Ratios must sum to 100% (currently ${totalRatio.toFixed(2)}%)`;
    // Check for duplicate raw material types
    const ids = ingredients.map((i) => i.rawMaterialTypeId).filter(Boolean);
    if (new Set(ids).size !== ids.length) errs.ingredients = 'Duplicate raw material types are not allowed';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, ingredients, totalRatio]);

  const addIngredient = () => setIngredients([...ingredients, { rawMaterialTypeId: '', ratioPercent: '' }]);
  const removeIngredient = (idx: number) => setIngredients(ingredients.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    setIngredients(ingredients.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createRecipe({
        name: name.trim(),
        description: description.trim() || undefined,
        ingredients: ingredients.map((i) => ({
          rawMaterialTypeId: i.rawMaterialTypeId,
          ratioPercent: parseFloat(i.ratioPercent),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setToast({ type: 'success', message: 'Recipe created' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err?.response?.data?.error?.message ?? 'Failed to create recipe' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateRecipe(recipe!.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        ingredients: ingredients.map((i) => ({
          rawMaterialTypeId: i.rawMaterialTypeId,
          ratioPercent: parseFloat(i.ratioPercent),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setToast({ type: 'success', message: 'Recipe updated' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err?.response?.data?.error?.message ?? 'Failed to update recipe' });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Recipe' : 'New Recipe'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {toast && (
          <div className={`rounded-md p-3 text-sm ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {toast.message}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Recipe Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="e.g. Standard Mix 70/30"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Ingredients *</label>
            <span className={`text-xs font-medium ${Math.abs(totalRatio - 100) < 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
              Total: {totalRatio.toFixed(1)}%
            </span>
          </div>

          <div className="mt-2 space-y-2">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={grainOptions}
                    value={ing.rawMaterialTypeId}
                    onChange={(val) => updateIngredient(idx, 'rawMaterialTypeId', val)}
                    placeholder="Select raw material type..."
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={ing.ratioPercent}
                    onChange={(e) => updateIngredient(idx, 'ratioPercent', e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="%"
                  />
                </div>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> Add Ingredient
          </button>

          {errors.ingredients && <p className="mt-1 text-xs text-red-600">{errors.ingredients}</p>}
          {errors.total && <p className="mt-1 text-xs text-red-600">{errors.total}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function RecipeManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  const { data: recipesData, isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => settingsApi.getRecipes(),
  });

  const { data: grainData } = useQuery({
    queryKey: ['grain-types'],
    queryFn: () => settingsApi.getRawMaterialTypes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setDeleteTarget(null);
    },
  });

  const recipes = recipesData?.data ?? [];
  const rawMaterialTypes = grainData?.data ?? [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/settings')} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <FlaskConical size={22} className="text-indigo-600" />
              Recipes / Formulas
            </h1>
            <p className="text-xs text-gray-500">
              Create reusable grain-mix recipes that can be assigned to variants
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Recipe
        </button>
      </div>

      {/* Table */}
      {recipes.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <FlaskConical size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No recipes yet. Create your first recipe to define reusable grain-mix formulas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Formula</th>
                <th className="px-4 py-3">Ingredients</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recipes.map((recipe) => (
                <tr key={recipe.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{recipe.name}</div>
                    {recipe.description && <div className="text-xs text-gray-400">{recipe.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      <FlaskConical size={12} />
                      {recipe.ingredients.map((i) => `${i.rawMaterialType.code} ${Number(i.ratioPercent)}%`).join(' + ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{recipe.ingredients.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${recipe.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {recipe.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingRecipe(recipe)}
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(recipe)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editingRecipe) && (
        <RecipeFormModal
          recipe={editingRecipe}
          rawMaterialTypes={rawMaterialTypes}
          onClose={() => {
            setShowCreate(false);
            setEditingRecipe(null);
          }}
          onSuccess={() => {
            setShowCreate(false);
            setEditingRecipe(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Recipe"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
