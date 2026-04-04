import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Building2, CheckCircle, XCircle } from 'lucide-react';
import { settingsApi, type Company } from '../../services/settings.api';

interface FormState {
  name: string;
  address: string;
}

const EMPTY_FORM: FormState = { name: '', address: '' };

export function CompanyManagement() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ['settings', 'companies'],
    queryFn: () => settingsApi.getCompanies(),
  });
  const companies = result?.data ?? [];

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; address?: string }) => settingsApi.createCompany(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'companies'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      showToast('success', 'Company created successfully');
    },
    onError: () => showToast('error', 'Failed to create company'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Company> }) =>
      settingsApi.updateCompany(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'companies'] });
      setEditing(null);
      setForm(EMPTY_FORM);
      showToast('success', 'Company updated successfully');
    },
    onError: () => showToast('error', 'Failed to update company'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({ name: company.name, address: company.address ?? '' });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = { name: form.name.trim(), address: form.address.trim() || undefined };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleActive = (company: Company) => {
    updateMutation.mutate({ id: company.id, data: { isActive: !company.isActive } });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="rounded-lg border p-2 hover:bg-gray-50">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Companies</h1>
            <p className="text-sm text-gray-500">Manage companies used for voucher accounts</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Add Company
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg p-3 text-sm ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {toast.message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            {editing ? 'Edit Company' : 'New Company'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Company Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. ZIP Production Pvt Ltd"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Optional address"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending || !form.name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Company'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); }}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Company List */}
      <div className="rounded-lg border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading companies…</div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Building2 size={40} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No companies yet</p>
            <p className="mt-1 text-xs text-gray-400">Click "Add Company" to create your first company</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Company Name</th>
                <th className="px-4 py-3 text-left">Address</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{company.name}</td>
                  <td className="px-4 py-3 text-gray-500">{company.address ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      company.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {company.isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {company.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(company)}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        <Pencil size={13} className="inline mr-1" />Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(company)}
                        disabled={isPending}
                        className={`rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50 ${
                          company.isActive ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {company.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
