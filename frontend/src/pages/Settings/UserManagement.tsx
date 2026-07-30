import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type User } from '../../services/settings.api';
import { formatDateTimePKT } from '../../utils/date';
import { ROLES } from '../../utils/constants';

const ROLE_OPTIONS: SelectOption[] = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.FINANCE_HEAD, label: 'Finance Head' },
  { value: ROLES.PRODUCTION_HEAD, label: 'Production Head' },
  { value: ROLES.LOGISTICS_HEAD, label: 'Logistics Head' },
  { value: ROLES.MARKETING_HEAD, label: 'Marketing Head' },
];

const roleBadgeColor: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  FINANCE_HEAD: 'bg-emerald-100 text-emerald-800',
  PRODUCTION_HEAD: 'bg-blue-100 text-blue-800',
  LOGISTICS_HEAD: 'bg-yellow-100 text-yellow-800',
  MARKETING_HEAD: 'bg-pink-100 text-pink-800',
};

function roleBadge(role: string) {
  const label = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor[role] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {label}
    </span>
  );
}

// ─── Create / Edit Modal ────────────────────────────────────────────────────

interface UserFormModalProps {
  user?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

function UserFormModal({ user, onClose, onSuccess }: UserFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role ?? '');
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (!role) errs.role = 'Role is required';
    if (!isEdit && password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (isEdit && password && password.length < 8) errs.password = 'Password must be at least 8 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, email, role, password, isEdit]);

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; password: string; role: string }) =>
      settingsApi.createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setToast({ type: 'success', message: 'User created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create user' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<{ name: string; email: string; password: string; role: string; isActive: boolean }>) =>
      settingsApi.updateUser(user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setToast({ type: 'success', message: 'User updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update user' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) {
      updateMutation.mutate({ name: name.trim(), email: email.trim(), ...(password && { password }), role, isActive });
    } else {
      createMutation.mutate({ name: name.trim(), email: email.trim(), password, role });
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit User' : 'Create User'} size="sm">
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
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="Full name"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="name@company.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {isEdit ? 'New password (leave blank to keep current)' : 'Password'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
            placeholder={isEdit ? '••••••••' : 'At least 8 characters'}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>

        <SearchableSelect
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={setRole}
          placeholder="Select role"
          error={errors.role}
        />

        {isEdit && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Active
          </label>
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

// ─── Main Component ─────────────────────────────────────────────────────────

export function UserManagement() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings-users'],
    queryFn: settingsApi.getUsers,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      setDeactivateTarget(null);
    },
  });

  const users = data?.data ?? [];

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', hideOnMobile: true },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => roleBadge(row.role),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <span className="flex items-center gap-1.5 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${row.isActive ? 'bg-green-500' : 'bg-red-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      hideOnMobile: true,
      render: (row) =>
        row.lastLoginAt ? formatDateTimePKT(row.lastLoginAt) : '—',
    },
    {
      key: 'createdAt',
      header: 'Created',
      hideOnMobile: true,
      sortable: true,
      render: (row) => formatDateTimePKT(row.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditUser(row);
            }}
            className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            Edit
          </button>
          {row.isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeactivateTarget(row);
              }}
              className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  const mobileCard = (row: User) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
        {roleBadge(row.role)}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${row.isActive ? 'bg-green-500' : 'bg-red-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setEditUser(row)}
            className="min-h-[44px] text-blue-600"
          >
            Edit
          </button>
          {row.isActive && (
            <button
              onClick={() => setDeactivateTarget(row)}
              className="min-h-[44px] text-red-600"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );

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
              User Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage user accounts and roles
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Create User
        </button>
      </div>

      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No users found"
        />
      </div>

      {/* Create modal */}
      {showForm && (
        <UserFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {/* Edit modal */}
      {editUser && (
        <UserFormModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => setEditUser(null)}
        />
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
          title="Deactivate User"
          message={`Are you sure you want to deactivate "${deactivateTarget.name}"? They will lose access to the system.`}
          confirmLabel="Deactivate"
          variant="danger"
          isLoading={deactivateMutation.isPending}
        />
      )}
    </div>
  );
}
