import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { gatePassApi, type VerifyResult } from '../../services/gate-pass.api';

type VerifyState =
  | { status: 'loading' }
  | { status: 'success'; data: VerifyResult }
  | { status: 'error'; message: string; code?: string };

export function VerifyGatePass() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'No verification token provided', code: 'NO_TOKEN' });
      return;
    }

    gatePassApi
      .verify(token)
      .then((result) => {
        setState({ status: 'success', data: result.data });
      })
      .catch((err) => {
        const errorData = err.response?.data?.error;
        setState({
          status: 'error',
          message: errorData?.message || 'Verification failed',
          code: errorData?.code,
        });
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        {/* Logo */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">ZIP Production</h1>
          <p className="text-sm text-gray-500">Gate Pass Verification</p>
        </div>

        {/* Loading State */}
        {state.status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={48} className="animate-spin text-blue-500" />
            <p className="text-gray-600">Verifying gate pass...</p>
          </div>
        )}

        {/* Success State */}
        {state.status === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle size={56} className="text-green-500" />
              <h2 className="text-xl font-bold text-green-700">
                {state.data.status === 'already_received'
                  ? 'Already Received'
                  : 'Verified & Received'}
              </h2>
            </div>

            <div className="rounded-lg bg-green-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gate Pass #</span>
                <span className="font-semibold">{state.data.gatePassNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Client</span>
                <span className="font-semibold">{state.data.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-bold text-lg">{state.data.totalAmountDisplay}</span>
              </div>
              {state.data.receivedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Received At</span>
                  <span>{new Date(state.data.receivedAt).toLocaleString('en-PK')}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Items</h3>
              <div className="space-y-1">
                {state.data.lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between rounded bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {li.variant.code} — {li.variant.name}
                    </span>
                    <span className="font-medium">{li.meters}m</span>
                  </div>
                ))}
              </div>
            </div>

            {state.data.status === 'already_received' && (
              <p className="text-center text-sm text-yellow-600">
                ⚠️ This gate pass was already marked as received
              </p>
            )}
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8">
            {state.code === 'TOKEN_EXPIRED' ? (
              <AlertTriangle size={56} className="text-yellow-500" />
            ) : (
              <XCircle size={56} className="text-red-500" />
            )}
            <h2 className="text-xl font-bold text-red-700">Verification Failed</h2>
            <p className="text-center text-gray-600">{state.message}</p>
            {state.code === 'TOKEN_EXPIRED' && (
              <p className="text-center text-sm text-yellow-600">
                The verification token has expired. Please contact the logistics team.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
