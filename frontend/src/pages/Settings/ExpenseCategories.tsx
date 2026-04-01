import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type ExpenseCategory } from '../../services/settings.api';

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface CategoryFormModalProps {
  category?: ExpenseCategory | null;
  parentOptions: SelectOption[];
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryFormModal({
  category,
  parentOptions,
  onClose,
  onSuccess,
}: CategoryFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Category name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createExpenseCategory({
        name: name.trim(),
        parentId: parentId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-expense-categories'] });
      setToast({ type: 'success', message: 'Category created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateExpenseCategory(category!.id, { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-expense-categories'] });
      setToast({ type: 'success', message: 'Category updated!' });
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
      title={isEdit ? 'Edit Category' : 'Add Category'}
      size="sm"
    >
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Category Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="e.g. Office Supplies"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        {!isEdit && (
          <SearchableSelect
            label="Parent Category (optional)"
            options={parentOptions}
            value={parentId}
            onChange={setParentId}
            placeholder="None (top-level)"
            clearable
          />
        )}

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
                <Loader2 size={16} className="animate-spin" />
                Saving…
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

// ─── Tree Row ───────────────────────────────────────────────────────────────

interface TreeRowProps {
  category: ExpenseCategory;
  depth: number;
  onEdit: (cat: ExpenseCategory) => void;
  onDelete: (cat: ExpenseCategory) => void;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
}

function TreeRow({
  category,
  depth,
  onEdit,
  onDelete,
  expanded,
  toggleExpand,
}: TreeRowProps) {
  const hasChildren = (category.children?.length ?? 0) > 0;
  const isOpen = expanded.has(category.id);

  return (
    <>
      <div
        className={`flex items-center border-b px-4 py-2 hover:bg-gray-50 ${!category.isActive ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && toggleExpand(category.id)}
          className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          )}
        </button>

        {/* Name */}
        <span className="flex-1 text-sm text-gray-900">{category.name}</span>

        {/* Status */}
        {!category.isActive && (
          <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Inactive
          </span>
        )}

        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(category)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(category)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren &&
        isOpen &&
        category.children!.map((child) => (
          <TreeRow
            key={child.id}
            category={child}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            expanded={expanded}
            toggleExpand={toggleExpand}
          />
        ))}
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build tree from flat list: group children under parents */
function buildTree(categories: ExpenseCategory[]): ExpenseCategory[] {
  const map = new Map<string, ExpenseCategory>();
  const roots: ExpenseCategory[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Flatten tree to get parent options (only top-level categories) */
function getParentOptions(categories: ExpenseCategory[]): SelectOption[] {
  return categories
    .filter((c) => !c.parentId && c.isActive)
    .map((c) => ({ value: c.id, label: c.name }));
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ExpenseCategories() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<ExpenseCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['settings-expense-categories'],
    queryFn: settingsApi.getExpenseCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteExpenseCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-expense-categories'] });
      setDeleteTarget(null);
    },
  });

  const flatCategories = data?.data ?? [];
  const tree = buildTree(flatCategories);
  const parentOptions = getParentOptions(flatCategories);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
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
              Expense Categories
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Organise expense categories in a tree
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      <div className="rounded-lg border bg-white">
        {/* Header */}
        <div className="flex items-center border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-gray-500">
          <span className="flex-1 pl-8">Category Name</span>
          <span className="w-24 text-right">Actions</span>
        </div>

        {tree.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No expense categories configured
          </div>
        ) : (
          tree.map((cat) => (
            <TreeRow
              key={cat.id}
              category={cat}
              depth={0}
              onEdit={setEditCategory}
              onDelete={setDeleteTarget}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <CategoryFormModal
          parentOptions={parentOptions}
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {/* Edit modal */}
      {editCategory && (
        <CategoryFormModal
          category={editCategory}
          parentOptions={parentOptions}
          onClose={() => setEditCategory(null)}
          onSuccess={() => setEditCategory(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          title="Delete Category"
          message={`Are you sure you want to delete "${deleteTarget.name}"? This may affect existing vouchers using this category.`}
          confirmLabel="Delete"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
