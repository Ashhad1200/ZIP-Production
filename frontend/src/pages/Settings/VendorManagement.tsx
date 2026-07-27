import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type Vendor } from '../../services/settings.api';

// ─── Form Modal ──────────────────────────────────────────────────────────────

interface VendorFormModalProps {
  vendor?: Vendor | null;
  onClose: () => void;
  onSuccess: () => void;
}

function VendorFormModal({ vendor, onClose, onSuccess }: VendorFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!vendor;

  const [name, setName] = useState(vendor?.name ?? '');
  const [contactName, setContactName] = useState(vendor?.contactName ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [rawMaterialTypes, setRawMaterialTypes] = useState(vendor?.rawMaterialTypes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Vendor name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createVendor({
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        rawMaterialTypes: rawMaterialTypes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setToast({ type: 'success', message: 'Vendor created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => setToast({ type: 'error', message: err.message || 'Failed to create vendor' }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateVendor(vendor!.id, {
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        rawMaterialTypes: rawMaterialTypes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setToast({ type: 'success', message: 'Vendor updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => setToast({ type: 'error', message: err.message || 'Failed to update vendor' }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Vendor' : 'Add Vendor'} size="md">
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Vendor Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="e.g. Al-Madina Grain Suppliers"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contact Person</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. 0300-1234567"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Full address"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Raw Material Types Supplied</label>
          <input
            type="text"
            value={rawMaterialTypes}
            onChange={(e) => setRawMaterialTypes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 3D, Glass (comma-separated)"
          />
          <p className="mt-1 text-xs text-gray-500">Comma-separated raw material type codes this vendor supplies</p>
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
            {isPending ? <><Loader2 size={16} className="animate-spin" />Saving…</> : isEdit ? 'Update' : 'Add Vendor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VendorManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => settingsApi.getVendors(true),
  });
  const vendors = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsApi.deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setDeleteTarget(null);
      setToast({ type: 'success', message: 'Vendor removed.' });
    },
    onError: (err: Error) => setToast({ type: 'error', message: err.message || 'Cannot delete vendor' }),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Vendors</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage raw material suppliers</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Vendor
        </button>
      </div>

      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {toast.message}
        </div>
      )}

      <div className="rounded-lg border bg-white">
        {vendors.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">No vendors added yet.</div>
        ) : (
          <div className="divide-y">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{vendor.name}</span>
                    {!vendor.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    {vendor.contactName && <span>{vendor.contactName}</span>}
                    {vendor.phone && <span>{vendor.phone}</span>}
                    {vendor.rawMaterialTypes && <span>Grain types: {vendor.rawMaterialTypes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditTarget(vendor); setShowForm(true); }}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(vendor)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <VendorFormModal
          vendor={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSuccess={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <Modal open onClose={() => setDeleteTarget(null)} title="Remove Vendor" size="sm">
          <p className="text-sm text-gray-700">
            Remove <strong>{deleteTarget.name}</strong>? This cannot be undone if the vendor has no purchases.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Remove
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
