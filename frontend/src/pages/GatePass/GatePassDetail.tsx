import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Truck, Printer } from 'lucide-react';
import { gatePassApi } from '../../services/gate-pass.api';
import { LoadingSpinner, StatusBadge, ConfirmDialog } from '../../components/ui';

export function GatePassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['gate-pass', id],
    queryFn: () => gatePassApi.getById(id!),
    enabled: !!id,
  });

  const gatePass = result?.data;

  const statusMutation = useMutation({
    mutationFn: ({ status, version }: { status: 'DISPATCHED' | 'RECEIVED'; version: number }) =>
      gatePassApi.updateStatus(id!, status, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-pass', id] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      setToast({ type: 'success', message: 'Status updated successfully' });
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to update status',
      });
    },
  });

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (isLoading) return <LoadingSpinner />;
  if (error || !gatePass) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Gate pass not found</p>
        <button onClick={() => navigate('/gate-pass')} className="mt-4 text-blue-600 hover:underline">
          Back to list
        </button>
      </div>
    );
  }

  const handleMarkDispatched = () => {
    setShowDispatchConfirm(false);
    statusMutation.mutate({ status: 'DISPATCHED', version: gatePass.version });
  };

  const handlePrint = () => {
    navigate(`/gate-pass/${id}/pdf`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/gate-pass')}
            className="rounded-lg border p-2 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{gatePass.gatePassNumber}</h1>
            <p className="text-sm text-gray-500">
              {gatePass.shift === 'DAY' ? '☀️ Day' : '🌙 Night'} Shift &middot;{' '}
              {new Date(gatePass.date + 'T00:00:00').toLocaleDateString('en-PK', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={gatePass.status} />
          {gatePass.status === 'CREATED' && (
            <button
              onClick={() => setShowDispatchConfirm(true)}
              disabled={statusMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Truck size={16} /> Mark Dispatched
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg p-4 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Client & Order Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Client Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium">{gatePass.client.name}</dd>
            </div>
            {gatePass.client.contactPerson && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Contact</dt>
                <dd>{gatePass.client.contactPerson}</dd>
              </div>
            )}
            {gatePass.client.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd>{gatePass.client.phone}</dd>
              </div>
            )}
            {gatePass.client.address && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Address</dt>
                <dd className="text-right max-w-[200px]">{gatePass.client.address}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Gate Pass Info</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Issuing Manager</dt>
              <dd className="font-medium">{gatePass.issuingManagerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Amount</dt>
              <dd className="font-bold text-lg">{gatePass.totalAmountDisplay}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Payment Due</dt>
              <dd>
                {new Date(gatePass.paymentDueDate + 'T00:00:00').toLocaleDateString('en-PK', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </dd>
            </div>
            {gatePass.order && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Linked Order</dt>
                <dd className="text-blue-700">{gatePass.order.orderNumber}</dd>
              </div>
            )}
            {gatePass.receivedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Received At</dt>
                <dd>{new Date(gatePass.receivedAt).toLocaleString('en-PK')}</dd>
              </div>
            )}
            {gatePass.journalEntry && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Journal Entry</dt>
                <dd>
                  <span className="text-gray-700">{gatePass.journalEntry.entryNumber}</span>
                  <StatusBadge status={gatePass.journalEntry.status} className="ml-2" />
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3 text-right">Meters</th>
                <th className="px-4 py-3 text-right">Rate/m</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gatePass.lineItems.map((li, idx) => (
                <tr key={li.id}>
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{li.variant.code}</span>
                    <span className="ml-2 text-gray-500">{li.variant.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{li.meters.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{li.ratePerMeterDisplay}</td>
                  <td className="px-4 py-3 text-right font-medium">{li.lineAmountDisplay}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-lg">{gatePass.totalAmountDisplay}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Status History */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Status Timeline</h2>
        <div className="flex items-center gap-3">
          {(['CREATED', 'DISPATCHED', 'RECEIVED'] as const).map((s, idx) => {
            const isActive = gatePass.status === s;
            const isPast =
              (s === 'CREATED') ||
              (s === 'DISPATCHED' && ['DISPATCHED', 'RECEIVED'].includes(gatePass.status)) ||
              (s === 'RECEIVED' && gatePass.status === 'RECEIVED');

            return (
              <div key={s} className="flex items-center gap-3">
                {idx > 0 && (
                  <div className={`h-0.5 w-8 ${isPast ? 'bg-blue-500' : 'bg-gray-200'}`} />
                )}
                <div
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    isActive
                      ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-500'
                      : isPast
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Created: {new Date(gatePass.createdAt).toLocaleString('en-PK')}
          {gatePass.receivedAt && <> &middot; Received: {new Date(gatePass.receivedAt).toLocaleString('en-PK')}</>}
        </p>
      </div>

      {/* Dispatch Confirm Dialog */}
      <ConfirmDialog
        open={showDispatchConfirm}
        onClose={() => setShowDispatchConfirm(false)}
        onConfirm={handleMarkDispatched}
        title="Mark as Dispatched"
        message={`Mark gate pass ${gatePass.gatePassNumber} as dispatched?`}
        confirmLabel="Dispatch"
        variant="warning"
        isLoading={statusMutation.isPending}
      />
    </div>
  );
}
