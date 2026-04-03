import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui';
import { CurrencyInput, SearchableSelect } from '../../../components/forms';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import {
  financeApi,
  type ClientRate,
  type UpdateRatePayload,
} from '../../../services/finance.api';
import { formatDatePKT } from '../../../utils/date';

export function RateManagement() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [newRatePaisa, setNewRatePaisa] = useState(0);
  const [updateError, setUpdateError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['client-rates', clientId],
    queryFn: () => financeApi.getClientRates(clientId!),
    enabled: !!clientId,
  });

  const rates: ClientRate[] = data?.data ?? [];

  // Rates that have an active (current) entry
  const activeRates = rates.filter((r) => r.current !== null);
  // All history entries flattened for the history table
  const historicalEntries = rates.flatMap((r) =>
    r.history.map((h) => ({ variant: r.variant, ...h })),
  );

  const mutation = useMutation({
    mutationFn: (payload: UpdateRatePayload) =>
      financeApi.updateClientRate(clientId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-rates', clientId] });
      setShowUpdateModal(false);
      setSelectedVariantId('');
      setNewRatePaisa(0);
      setUpdateError('');
    },
    onError: (err) => {
      setUpdateError((err as Error)?.message ?? 'Failed to update rate');
    },
  });

  function openUpdateModal(rate: ClientRate) {
    setSelectedVariantId(rate.variant.id);
    setNewRatePaisa(Number(rate.current?.ratePerMeterPaisa ?? 0));
    setShowUpdateModal(true);
    setUpdateError('');
  }

  function handleUpdate() {
    if (!selectedVariantId) return;
    if (newRatePaisa <= 0) {
      setUpdateError('Rate must be greater than 0');
      return;
    }
    mutation.mutate({
      variantId: selectedVariantId,
      newRatePerMeterPaisa: newRatePaisa,
    });
  }

  const variantOptions = activeRates.map((r) => ({
    value: r.variant.id,
    label: `${r.variant.code} - ${r.variant.name}`,
  }));

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/finance/client-ledger/${clientId}`)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Rate Management
          </h1>
          <p className="text-sm text-gray-500">
            Manage per-variant pricing for this client
          </p>
        </div>
      </div>

      {/* Active Rates */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Active Rates
        </h2>
        {activeRates.length === 0 ? (
          <p className="text-sm text-gray-500">No active rates configured.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeRates.map((rate) => (
              <div
                key={rate.variant.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">
                      {rate.variant.code}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {rate.variant.name}
                    </p>
                  </div>
                  <button
                    onClick={() => openUpdateModal(rate)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
                    title="Update Rate"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
                <p className="mt-2 text-lg font-bold text-blue-600">
                  {rate.current!.ratePerMeterDisplay}
                  <span className="text-sm font-normal text-gray-500">
                    /meter
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Effective from: {formatDatePKT(rate.current!.effectiveFrom)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historical Rates */}
      {historicalEntries.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <History size={18} />
            Rate History
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Variant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Rate/Meter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    From
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    To
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {historicalEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {entry.variant.code} - {entry.variant.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                      {entry.ratePerMeterDisplay}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDatePKT(entry.effectiveFrom)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {entry.effectiveTo ? formatDatePKT(entry.effectiveTo) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Update Rate Modal */}
      {showUpdateModal && (
        <Modal
          open
          onClose={() => setShowUpdateModal(false)}
          title="Update Rate"
          size="sm"
        >
          <div className="space-y-4">
            <SearchableSelect
              label="Variant"
              options={variantOptions}
              value={selectedVariantId}
              onChange={setSelectedVariantId}
              placeholder="Select variant"
              disabled
            />

            <CurrencyInput
              label="New Rate per Meter"
              value={newRatePaisa}
              onChange={setNewRatePaisa}
              placeholder="e.g. 150"
            />

            {updateError && (
              <p className="text-sm text-red-600">{updateError}</p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowUpdateModal(false)}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={mutation.isPending}
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Updating...' : 'Update Rate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
