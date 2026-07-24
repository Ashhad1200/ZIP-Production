import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import platformApi from '../../services/platform.api';
import { DataTable, Modal, StatusBadge, type Column } from '../../components/ui';
import { formatPaisaToRupees } from '../../utils/currency';
import { formatDatePKT } from '../../utils/date';

interface PaymentRow {
  id: string;
  amountClaimedPaisa: string;
  screenshotUrl: string;
  transactionRef: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  submittedAt: string;
  rejectionReason: string | null;
  organization: { id: string; name: string };
  plan: { id: string; name: string };
}

const statusFilters = ['PENDING', 'VERIFIED', 'REJECTED'] as const;

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>('PENDING');
  const [reviewing, setReviewing] = useState<PaymentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery<PaymentRow[]>({
    queryKey: ['platform', 'payments', statusFilter],
    queryFn: async () => (await platformApi.get<{ data: PaymentRow[] }>(`/payments?status=${statusFilter}`)).data.data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform', 'payments'] });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => platformApi.post(`/payments/${id}/verify`),
    onSuccess: () => {
      toast.success('Payment verified — plan attached');
      setReviewing(null);
      invalidate();
    },
    onError: () => toast.error('Failed to verify payment'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => platformApi.post(`/payments/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Payment rejected');
      setReviewing(null);
      setRejectReason('');
      invalidate();
    },
    onError: () => toast.error('Failed to reject payment'),
  });

  const columns: Column<PaymentRow>[] = [
    { key: 'organization', header: 'Organization', render: (row) => row.organization.name },
    { key: 'plan', header: 'Plan', render: (row) => row.plan.name },
    { key: 'amount', header: 'Amount Claimed', render: (row) => formatPaisaToRupees(Number(row.amountClaimedPaisa)) },
    { key: 'submittedAt', header: 'Submitted', hideOnMobile: true, render: (row) => formatDatePKT(row.submittedAt) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">Manual bank-transfer proofs awaiting verification</p>
      </div>

      <div className="flex gap-2">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              statusFilter === s ? 'bg-gray-900 text-white' : 'border bg-white text-gray-700'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white">
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setReviewing(row)}
          emptyMessage="No payments in this status"
        />
      </div>

      <Modal
        open={!!reviewing}
        onClose={() => {
          setReviewing(null);
          setRejectReason('');
        }}
        title={reviewing ? `${reviewing.organization.name} — ${reviewing.plan.name}` : ''}
        size="lg"
        footer={
          reviewing?.status === 'PENDING' ? (
            <>
              <input
                placeholder="Rejection reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mr-auto w-64 rounded-lg border px-3 py-2 text-sm"
              />
              <button
                onClick={() => reviewing && rejectMutation.mutate({ id: reviewing.id, reason: rejectReason })}
                disabled={!rejectReason || rejectMutation.isPending}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => reviewing && verifyMutation.mutate(reviewing.id)}
                disabled={verifyMutation.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {verifyMutation.isPending ? 'Verifying...' : 'Verify & Attach Plan'}
              </button>
            </>
          ) : undefined
        }
      >
        {reviewing && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-gray-500">Amount claimed:</span>{' '}
              <span className="font-medium">{formatPaisaToRupees(Number(reviewing.amountClaimedPaisa))}</span>
            </p>
            {reviewing.transactionRef && (
              <p className="text-sm">
                <span className="text-gray-500">Reference:</span> {reviewing.transactionRef}
              </p>
            )}
            {reviewing.rejectionReason && (
              <p className="text-sm text-red-600">Rejected: {reviewing.rejectionReason}</p>
            )}
            <img src={reviewing.screenshotUrl} alt="Payment screenshot" className="max-h-[50vh] w-full rounded-lg border object-contain" />
          </div>
        )}
      </Modal>
    </div>
  );
}
