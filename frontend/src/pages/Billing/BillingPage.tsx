import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { billingApi } from '../../services/billing.api';
import { LoadingSpinner } from '../../components/ui';
import { formatPaisaToRupees } from '../../utils/currency';
import { formatDatePKT } from '../../utils/date';

/**
 * Tenant-facing billing screen: shows trial/subscription status and, once
 * trial has ended (or the tenant just wants to pay early), the bank details
 * + manual payment-proof submission flow — see
 * docs/SAAS-PLATFORM-BLUEPRINT.md section 2.4. Deliberately not a hard
 * lockout even when PAST_DUE (constitution: "the system MUST NOT enter a
 * broken state") — this page is reachable any time from a persistent nav
 * item / banner, not a modal that blocks the rest of the app.
 */
export function BillingPage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'my-subscription'],
    queryFn: billingApi.getMySubscription,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['billing', 'bank-accounts'],
    queryFn: billingApi.getBankAccounts,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      billingApi.submitPayment({
        amountClaimedPaisa: Math.round(parseFloat(amount || '0') * 100),
        screenshotUrl,
        transactionRef: transactionRef || undefined,
        bankAccountId: selectedBankId,
      }),
    onSuccess: () => {
      toast.success('Payment submitted — we will verify it shortly');
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: () => toast.error('Failed to submit payment'),
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  if (!subscription) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
        No subscription found for your account.
      </div>
    );
  }

  const trialDaysLeft = Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000));
  const needsPayment = subscription.status === 'TRIAL' || subscription.status === 'PAST_DUE';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500">Your plan, trial, and payment history</p>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="text-lg font-semibold text-gray-900">{subscription.plan.name}</p>
            <p className="text-sm text-gray-500">
              {formatPaisaToRupees(Number(subscription.plan.pricePaisa))} / {subscription.plan.billingCycleDays} days
            </p>
          </div>
          <StatusPill status={subscription.status} />
        </div>

        {subscription.status === 'TRIAL' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <Clock size={16} />
            {trialDaysLeft > 0
              ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your free trial (ends ${formatDatePKT(subscription.trialEndsAt)})`
              : 'Your trial has ended — submit payment below to keep your access active.'}
          </div>
        )}

        {subscription.status === 'PAST_DUE' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={16} />
            Payment is due. Your data and access are safe, but please submit payment below to avoid interruption.
          </div>
        )}

        {subscription.status === 'ACTIVE' && subscription.currentPeriodEnd && (
          <p className="mt-4 text-sm text-gray-500">Active until {formatDatePKT(subscription.currentPeriodEnd)}</p>
        )}
      </div>

      {needsPayment && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Pay by bank transfer</h2>

          {submitted ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle2 size={18} />
              Payment submitted. Our team will verify it and activate your plan shortly.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Transfer to one of our bank accounts:</p>
                <div className="space-y-2">
                  {(bankAccounts ?? []).map((acc) => (
                    <label
                      key={acc.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                        selectedBankId === acc.id ? 'border-gray-900' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="bank"
                        checked={selectedBankId === acc.id}
                        onChange={() => setSelectedBankId(acc.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{acc.bankName}</p>
                        <p className="text-gray-600">{acc.accountTitle} — {acc.accountNumber}</p>
                        {acc.iban && <p className="text-gray-500">IBAN: {acc.iban}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Amount paid (PKR)</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(Number(subscription.plan.pricePaisa) / 100)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Transaction reference (optional)</span>
                <input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Payment screenshot URL</span>
                <input
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  placeholder="Paste the link to your uploaded screenshot"
                  className="w-full rounded-lg border px-3 py-2"
                />
                <span className="mt-1 block text-xs text-gray-400">
                  Upload your transfer screenshot to any image host, then paste the link here.
                </span>
              </label>

              <button
                onClick={() => submitMutation.mutate()}
                disabled={!amount || !screenshotUrl || submitMutation.isPending}
                className="w-full rounded-lg bg-gray-900 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit payment for verification'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    TRIAL: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    PAST_DUE: 'bg-amber-100 text-amber-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    CANCELED: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
