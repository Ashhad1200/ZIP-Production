import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type Client } from '../../services/settings.api';
import { formatPaisaToRupees } from '../../utils/currency';

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface ClientFormModalProps {
  client?: Client | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ClientFormModal({ client, onClose, onSuccess }: ClientFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!client;

  const [name, setName] = useState(client?.name ?? '');
  const [contactPerson, setContactPerson] = useState(client?.contactPerson ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [paymentCycleDays, setPaymentCycleDays] = useState(
    String(client?.paymentCycleDays ?? 30),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Client name is required';
    const days = Number(paymentCycleDays);
    if (isNaN(days) || days < 1) errs.paymentCycleDays = 'Must be a positive number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, paymentCycleDays]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createClient({
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        paymentCycleDays: Number(paymentCycleDays),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-clients'] });
      setToast({ type: 'success', message: 'Client created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create client' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateClient(client!.id, {
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        paymentCycleDays: Number(paymentCycleDays),
      } as Partial<Client>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-clients'] });
      setToast({ type: 'success', message: 'Client updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update client' });
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
      title={isEdit ? 'Edit Client' : 'Create Client'}
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Client Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="e.g. ABC Textiles"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Contact Person
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Phone
            </label>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Full address"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Payment Cycle (days)
          </label>
          <input
            type="number"
            value={paymentCycleDays}
            onChange={(e) => setPaymentCycleDays(e.target.value)}
            min={1}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.paymentCycleDays ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.paymentCycleDays && (
            <p className="mt-1 text-xs text-red-600">{errors.paymentCycleDays}</p>
          )}
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

// ─── Rates Drawer ───────────────────────────────────────────────────────────

function ClientRatesPanel({ client }: { client: Client }) {
  const rates = client.clientRates ?? [];

  if (rates.length === 0) {
    return (
      <p className="py-2 text-xs text-gray-400">No rates configured</p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-gray-50 p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-1 font-medium">Variant</th>
            <th className="pb-1 font-medium">Rate / meter</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id} className="border-t border-gray-200">
              <td className="py-1">
                {r.variant ? `${r.variant.code} – ${r.variant.name}` : r.variantId}
              </td>
              <td className="py-1">{formatPaisaToRupees(r.ratePerMeterPaisa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ClientManagement() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings-clients'],
    queryFn: settingsApi.getClients,
  });

  const clients = data?.data ?? [];

  const columns: Column<Client>[] = [
    {
      key: 'expand',
      header: '',
      className: 'w-10',
      render: (row) => {
        const hasRates = (row.clientRates?.length ?? 0) > 0;
        if (!hasRates) return null;
        const isOpen = expandedId === row.id;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(isOpen ? null : row.id);
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        );
      },
    },
    { key: 'name', header: 'Client Name', sortable: true },
    {
      key: 'contactPerson',
      header: 'Contact',
      hideOnMobile: true,
      render: (row) => row.contactPerson || '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      hideOnMobile: true,
      render: (row) => row.phone || '—',
    },
    {
      key: 'paymentCycleDays',
      header: 'Payment Cycle',
      sortable: true,
      render: (row) => `${row.paymentCycleDays} days`,
    },
    {
      key: 'rates',
      header: 'Rates',
      render: (row) => (
        <span className="text-xs text-gray-500">
          {row.clientRates?.length ?? 0} variants
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
            setEditClient(row);
          }}
          className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          Edit
        </button>
      ),
    },
  ];

  const mobileCard = (row: Client) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
        <button
          onClick={() => setEditClient(row)}
          className="min-h-[44px] text-xs text-blue-600"
        >
          Edit
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        {row.contactPerson && <span>{row.contactPerson}</span>}
        {row.phone && <span>{row.phone}</span>}
        <span>{row.paymentCycleDays} day cycle</span>
        <span>{row.clientRates?.length ?? 0} rates</span>
      </div>
      {expandedId === row.id && <ClientRatesPanel client={row} />}
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
              Client Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Manage clients and payment rates
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Create Client
        </button>
      </div>

      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={clients}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          onRowClick={(row) =>
            setExpandedId(expandedId === row.id ? null : row.id)
          }
          mobileCard={mobileCard}
          emptyMessage="No clients found"
        />

        {/* Inline expanded rates */}
        {expandedId &&
          clients.find((c) => c.id === expandedId) && (
            <div className="hidden border-t bg-gray-50 px-4 py-3 md:block">
              <ClientRatesPanel
                client={clients.find((c) => c.id === expandedId)!}
              />
            </div>
          )}
      </div>

      {showForm && (
        <ClientFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {editClient && (
        <ClientFormModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSuccess={() => setEditClient(null)}
        />
      )}
    </div>
  );
}
