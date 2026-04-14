import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, LockOpen, FlaskConical } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  productionApi,
  type CompleteProductionEntryPayload,
} from '../../services/production.api';
import { useRole } from '../../hooks/useRole';

interface FormErrors {
  metersProduced?: string;
  gramsPerMeter?: string;
  electricityEnd?: string;
}

export function ProductionEntryComplete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();

  const [metersProduced, setMetersProduced] = useState('');
  const [gramsPerMeter, setGramsPerMeter] = useState('');
  const [scrapWeightGrams, setScrapWeightGrams] = useState('');
  const [electricityEnd, setElectricityEnd] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: entryResp, isLoading } = useQuery({
    queryKey: ['production-entry', id],
    queryFn: () => productionApi.getEntryById(id!),
    enabled: !!id,
  });
  const entry = entryResp?.data;

  // Pre-fill grams/meter from variant standard value
  useEffect(() => {
    if (!entry?.shiftVariants?.length) return;
    const sv = entry.shiftVariants[0];
    if (sv?.metersProduced != null && sv.metersProduced > 0)
      setMetersProduced(String(sv.metersProduced));
    if (gramsPerMeter === '' && sv?.gramsPerMeter != null)
      setGramsPerMeter(String(sv.gramsPerMeter));
    else if (gramsPerMeter === '' && sv?.variant?.standardGramsPerMeter != null)
      setGramsPerMeter(String(sv.variant.standardGramsPerMeter));
    if (sv?.scrapWeightGrams != null && sv.scrapWeightGrams > 0)
      setScrapWeightGrams(String(sv.scrapWeightGrams));
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const elecStart = entry?.electricityStartReading;
  const electricityUnits =
    elecStart != null && electricityEnd
      ? Math.max(0, Number(electricityEnd) - elecStart)
      : null;

  const variant = entry?.shiftVariants?.[0];

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!metersProduced || Number(metersProduced) <= 0)
      errs.metersProduced = 'Enter meters produced (must be > 0)';
    if (!gramsPerMeter || Number(gramsPerMeter) <= 0)
      errs.gramsPerMeter = 'Enter grams per meter (must be > 0)';
    if (elecStart != null && electricityEnd && Number(electricityEnd) < elecStart)
      errs.electricityEnd = 'End reading must be ≥ start reading';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [metersProduced, gramsPerMeter, elecStart, electricityEnd]);

  const mutation = useMutation({
    mutationFn: (payload: CompleteProductionEntryPayload) =>
      productionApi.completeEntry(id!, payload),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Production completed! Stock updated.' });
      setTimeout(() => navigate('/production'), 1800);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to complete entry' });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => productionApi.unlockEntry(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-entry', id] });
      setToast({ type: 'success', message: 'Entry unlocked. You can now re-complete it.' });
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to unlock entry' });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !variant) return;
    mutation.mutate({
      electricityEndReading: electricityEnd ? Number(electricityEnd) : undefined,
      variants: [
        {
          variantId: variant.variantId,
          metersProduced: Number(metersProduced),
          gramsPerMeter: Number(gramsPerMeter),
          scrapWeightGrams: scrapWeightGrams ? Number(scrapWeightGrams) : undefined,
        },
      ],
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (isLoading) return <LoadingSpinner />;
  if (!entry) return <div className="p-6 text-red-600">Entry not found.</div>;

  if (entry.status === 'COMPLETED') {
    const totalMeters = entry.shiftVariants.reduce((s, sv) => s + sv.metersProduced, 0);
    const totalScrapGrams = entry.shiftVariants.reduce((s, sv) => s + (sv.scrapWeightGrams ?? 0), 0);
    const elecUnits = entry.electricityUnitsConsumed;

    return (
      <div className="mx-auto max-w-3xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Production Entry Detail</h1>
            <p className="mt-1 text-sm text-gray-500">Completed shift record</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/production')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            {isAdmin() && (
              <button
                onClick={() => {
                  if (window.confirm('Unlock this completed entry? This allows re-entering completion data.')) {
                    unlockMutation.mutate();
                  }
                }}
                disabled={unlockMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {unlockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                Unlock
              </button>
            )}
          </div>
        </div>

        {toast && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Status badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
          <CheckCircle size={16} /> Completed
        </div>

        {/* Info grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Date</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{entry.date}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Shift</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{entry.shift}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Plant</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{entry.plant.name}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Machine</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{entry.machine?.identifier ?? '—'}</p>
          </div>
        </div>

        {/* Production summary cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-600 uppercase">Total Meters</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{totalMeters.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-600 uppercase">Electricity Units</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{elecUnits != null ? elecUnits.toLocaleString() : '—'}</p>
            {entry.electricityStartReading != null && entry.electricityEndReading != null && (
              <p className="mt-0.5 text-xs text-amber-600">{entry.electricityStartReading} → {entry.electricityEndReading}</p>
            )}
            {entry.hasElectricityDiscrepancy && (
              <p className="mt-1 text-xs font-medium text-red-600">⚠ Discrepancy flagged</p>
            )}
          </div>
          <div className="rounded-xl border-l-4 border-gray-500 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 uppercase">Scrap Weight</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalScrapGrams > 0 ? `${(totalScrapGrams / 1000).toFixed(2)} kg` : '—'}
            </p>
          </div>
        </div>

        {/* Variants table */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">Variants Produced</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Recipe / Formula</th>
                  <th className="px-4 py-3 text-right">Meters</th>
                  <th className="px-4 py-3 text-right">Grams/Meter</th>
                  <th className="px-4 py-3 text-right">Scrap (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entry.shiftVariants.map((sv) => (
                  <tr key={sv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {sv.variant.code}
                      <span className="ml-1 text-gray-500 font-normal">– {sv.variant.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sv.variant.ingredients && sv.variant.ingredients.length > 0
                        ? sv.variant.ingredients.map((i) => `${i.grainTypeName} ${i.ratioPercent.toFixed(0)}%`).join(' + ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{sv.metersProduced.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{sv.gramsPerMeter ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{sv.scrapWeightGrams > 0 ? sv.scrapWeightGrams.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workers */}
        {entry.workers && entry.workers.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Workers</h3>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {entry.workers.map((w) => (
                <span key={w.id} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm">
                  {w.name}
                  {w.role && (
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      w.role === 'HEAD_OPERATOR' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {w.role === 'HEAD_OPERATOR' ? 'Head Op' : 'Asst'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Complete Production</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter shift-end data. Stock will be updated on completion.
        </p>
      </div>

      {/* Summary card */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-amber-800">In Production</p>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-amber-700">
          <span className="font-medium">Plant:</span>
          <span>{entry.plant.name}</span>
          <span className="font-medium">Shift:</span>
          <span>{entry.shift}</span>
          <span className="font-medium">Date:</span>
          <span>{entry.date}</span>
          <span className="font-medium">Variant:</span>
          <span>{variant ? `${variant.variant.code} – ${variant.variant.name}` : '—'}</span>
          {variant?.variant.ingredients && variant.variant.ingredients.length > 1 && (
            <>
              <span className="font-medium flex items-center gap-1">
                <FlaskConical size={12} className="text-indigo-600" /> Formula:
              </span>
              <span className="text-indigo-700">
                {variant.variant.ingredients.map((i) => `${i.grainTypeName} ${i.ratioPercent.toFixed(0)}%`).join(' + ')}
              </span>
            </>
          )}
          {entry.machine && (
            <>
              <span className="font-medium">Machine:</span>
              <span>{entry.machine.identifier}</span>
            </>
          )}
          {entry.electricityStartReading != null && (
            <>
              <span className="font-medium">Elec. Start:</span>
              <span>{entry.electricityStartReading}</span>
            </>
          )}
          {entry.workers && entry.workers.length > 0 && (
            <>
              <span className="font-medium">Workers:</span>
              <span>
                {entry.workers.map((w) => (
                  <span key={w.id} className="mr-3">
                    {w.name}
                    {w.role && (
                      <span className={`ml-1 rounded px-1 py-0.5 text-xs font-medium ${
                        w.role === 'HEAD_OPERATOR'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {w.role === 'HEAD_OPERATOR' ? 'Head Op' : 'Asst'}
                      </span>
                    )}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Production metrics */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-medium text-gray-700">Production Data</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Meters Produced <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={metersProduced}
                onChange={(e) => setMetersProduced(e.target.value)}
                placeholder="0"
                min="1"
                step="any"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  errors.metersProduced ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.metersProduced && (
                <p className="mt-1 text-xs text-red-600">{errors.metersProduced}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Grams / Meter <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={gramsPerMeter}
                onChange={(e) => setGramsPerMeter(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  errors.gramsPerMeter ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.gramsPerMeter && (
                <p className="mt-1 text-xs text-red-600">{errors.gramsPerMeter}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Scrap (grams, opt.)</label>
              <input
                type="number"
                inputMode="numeric"
                value={scrapWeightGrams}
                onChange={(e) => setScrapWeightGrams(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Electricity end reading */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-medium text-gray-700">Electricity Meter End</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">End Reading</label>
              <input
                type="number"
                inputMode="numeric"
                value={electricityEnd}
                onChange={(e) => setElectricityEnd(e.target.value)}
                placeholder="0"
                min="0"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  errors.electricityEnd ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.electricityEnd && (
                <p className="mt-1 text-xs text-red-600">{errors.electricityEnd}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Units Consumed</label>
              <div className="flex min-h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                {electricityUnits != null ? electricityUnits : '—'}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/production')}
            className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:flex-none"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Completing…
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Complete Production
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
