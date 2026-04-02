import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { StatusBadge } from '../../../components/ui';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useSmartQuery } from '../../../hooks/useSmartQuery';
import { useRole } from '../../../hooks/useRole';
import {
  financeApi,
  type Voucher,
  type ApproveRejectPayload,
} from '../../../services/finance.api';
import { formatDatePKT } from '../../../utils/date';
import { POLLING_INTERVALS } from '../../../utils/constants';

export function VoucherApproval() {
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: pendingData, isLoading: pendingLoading } = useSmartQuery({
    queryKey: ['finance-vouchers', 'pending'],
    queryFn: () =>
      financeApi.getVouchers({ approvalStatus: 'PENDING', limit: 100 }),
    pollingInterval: POLLING_INTERVALS.FINANCE,
  });

  const { data: historyData, isLoading: historyLoading } = useSmartQuery({
    queryKey: ['finance-vouchers', 'history'],
    queryFn: () =>
      financeApi.getVouchers({
        approvalStatus: showHistory ? undefined : 'PENDING',
        limit: 50,
      }),
    pollingInterval: POLLING_INTERVALS.FINANCE,
    enabled: showHistory,
  });

  const pendingVouchers = pendingData?.data ?? [];
  const historyVouchers = (historyData?.data ?? []).filter(
    (v) => v.approvalStatus === 'APPROVED' || v.approvalStatus === 'REJECTED',
  );

  const mutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ApproveRejectPayload;
    }) => financeApi.approveOrRejectVoucher(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-vouchers'] });
    },
  });

  function handleApprove(voucher: Voucher) {
    mutation.mutate({
      id: voucher.id,
      payload: {
        action: 'APPROVE',
        comment: comments[voucher.id]?.trim() || undefined,
      },
    });
  }

  function handleReject(voucher: Voucher) {
    const comment = comments[voucher.id]?.trim();
    if (!comment) {
      return; // Comment is required for rejection
    }
    mutation.mutate({
      id: voucher.id,
      payload: { action: 'REJECT', comment },
    });
  }

  if (!isAdmin()) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-gray-500">
          Only Super Admin can access voucher approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Voucher Approval
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve pending vouchers
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            showHistory
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          {showHistory ? 'Show Pending Only' : 'Show History'}
        </button>
      </div>

      {/* Pending Vouchers */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Clock size={18} className="text-yellow-500" />
          Pending Approval ({pendingVouchers.length})
        </h2>

        {pendingLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : pendingVouchers.length === 0 ? (
          <EmptyState message="No pending vouchers" />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="rounded-lg border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      {voucher.voucherNumber}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {voucher.title}
                    </h3>
                  </div>
                  <StatusBadge status={voucher.approvalStatus} />
                </div>

                {voucher.description && (
                  <p className="mt-2 text-sm text-gray-600">
                    {voucher.description}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Amount</span>
                    <p className="font-semibold text-gray-900">
                      {voucher.amountDisplay}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Date</span>
                    <p className="text-gray-900">
                      {formatDatePKT(voucher.date)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Category</span>
                    <p className="text-gray-900">{voucher.category.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Payment</span>
                    <p className="text-gray-900">
                      {voucher.paymentMode}
                      {voucher.chequeNumber && ` #${voucher.chequeNumber}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Company</span>
                    <p className="text-gray-900">{voucher.company.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Created by</span>
                    <p className="text-gray-900">{voucher.createdBy.name}</p>
                  </div>
                </div>

                {/* Comment textarea */}
                <div className="mt-4">
                  <textarea
                    value={comments[voucher.id] ?? ''}
                    onChange={(e) =>
                      setComments((prev) => ({
                        ...prev,
                        [voucher.id]: e.target.value,
                      }))
                    }
                    placeholder="Add a comment (required for rejection)..."
                    rows={2}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => handleApprove(voucher)}
                    disabled={mutation.isPending}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(voucher)}
                    disabled={
                      mutation.isPending ||
                      !comments[voucher.id]?.trim()
                    }
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {showHistory && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Approval History
          </h2>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : historyVouchers.length === 0 ? (
            <EmptyState message="No approval history" />
          ) : (
            <div className="space-y-3">
              {historyVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-4"
                >
                  <div>
                    <p className="text-xs text-gray-500">
                      {voucher.voucherNumber}
                    </p>
                    <p className="font-medium text-gray-900">{voucher.title}</p>
                    <p className="text-sm text-gray-500">
                      {voucher.amountDisplay} •{' '}
                      {formatDatePKT(voucher.date)}
                    </p>
                  </div>
                  <StatusBadge status={voucher.approvalStatus} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
