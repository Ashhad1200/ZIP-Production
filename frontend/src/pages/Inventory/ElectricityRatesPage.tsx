import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, type CreateElectricityRatePayload } from '../../services/inventory.api';
import { formatPaisaToRupees } from '../../utils/currency';
import { Zap, Plus, X } from 'lucide-react';

function AddRateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ ratePkrPerUnit: string; effectiveFrom: string; notes: string }>({
    ratePkrPerUnit: '',
    effectiveFrom: new Date().toISOString().split('T')[0]!,
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateElectricityRatePayload) =>
      inventoryApi.createElectricityRate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity-rates'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rateRupees = parseFloat(form.ratePkrPerUnit);
    if (!rateRupees || rateRupees <= 0) return;
    const payload: CreateElectricityRatePayload = {
      ratePaisaPerUnit: Math.round(rateRupees * 100),
      effectiveFrom: form.effectiveFrom,
      notes: form.notes.trim() || undefined,
    };
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Electricity Rate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate (PKR per unit)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.ratePkrPerUnit}
              onChange={e => setForm(f => ({ ...f, ratePkrPerUnit: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. 25.50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective From
            </label>
            <input
              type="date"
              required
              value={form.effectiveFrom}
              onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Summer 2025 tariff"
            />
          </div>

          {mutation.error && (
            <p className="text-sm text-red-600">Failed to save rate. Please try again.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save Rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ElectricityRatesPage() {
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['electricity-rates'],
    queryFn: () => inventoryApi.getElectricityRates(),
  });

  const rates = data?.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={24} className="text-yellow-500" />
            Electricity Rates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            PKR per kWh unit — used in cost price calculations
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Rate
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Failed to load electricity rates.
        </div>
      )}

      {!isLoading && !error && rates.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No rates configured. Add your first electricity rate to enable cost price calculations.
        </div>
      )}

      {rates.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-yellow-50 text-left text-xs text-yellow-800 uppercase tracking-wide">
                <th className="px-4 py-3">Rate (PKR / unit)</th>
                <th className="px-4 py-3">Effective From</th>
                <th className="px-4 py-3">Effective To</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(rate => {
                const isCurrent = rate.effectiveTo === null;
                return (
                  <tr key={rate.id} className={`border-t ${isCurrent ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatPaisaToRupees(rate.ratePaisaPerUnit)}
                    </td>
                    <td className="px-4 py-3">{rate.effectiveFrom}</td>
                    <td className="px-4 py-3 text-gray-500">{rate.effectiveTo ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{rate.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {isCurrent ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Current
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          Superseded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <AddRateModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
