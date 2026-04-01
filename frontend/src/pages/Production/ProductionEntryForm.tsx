import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { DatePicker } from '../../components/forms/DatePicker';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { WorkerMultiSelect } from '../../components/forms/WorkerMultiSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toISODate } from '../../utils/date';
import {
  productionApi,
  type Shift,
  type CreateProductionEntryPayload,
} from '../../services/production.api';

interface FormErrors {
  plantId?: string;
  shift?: string;
  date?: string;
  workerIds?: string;
  variantId?: string;
  metersProduced?: string;
  gramsPerMeter?: string;
  electricityStart?: string;
  electricityEnd?: string;
  scrapWeightGrams?: string;
}

export function ProductionEntryForm() {
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();

  // ── Form state ───────────────────────────────────────────────────────────
  const [plantId, setPlantId] = useState('');
  const [shift, setShift] = useState<Shift>('DAY');
  const [date, setDate] = useState(toISODate(new Date()));
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [variantId, setVariantId] = useState('');
  const [metersProduced, setMetersProduced] = useState('');
  const [gramsPerMeter, setGramsPerMeter] = useState('');
  const [electricityStart, setElectricityStart] = useState('');
  const [electricityEnd, setElectricityEnd] = useState('');
  const [scrapWeightGrams, setScrapWeightGrams] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Reference data queries ───────────────────────────────────────────────
  const { data: plantsResp, isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: productionApi.getPlants,
  });
  const plants = plantsResp?.data ?? [];

  const { data: workersResp, isLoading: workersLoading } = useQuery({
    queryKey: ['workers', plantId],
    queryFn: () => productionApi.getWorkers(plantId || undefined),
    enabled: !!plantId,
  });
  const workers = workersResp?.data ?? [];

  const { data: variantsResp, isLoading: variantsLoading } = useQuery({
    queryKey: ['variants'],
    queryFn: productionApi.getVariants,
  });
  const variants = variantsResp?.data ?? [];

  // ── Default plant from user context ──────────────────────────────────────
  useEffect(() => {
    if (plants.length > 0 && !plantId) {
      if (plants.length === 1 && plants[0]) {
        setPlantId(plants[0].id);
      }
    }
  }, [plants, plantId]);

  // ── Reset workers when plant changes ─────────────────────────────────────
  useEffect(() => {
    setWorkerIds([]);
  }, [plantId]);

  // ── Pre-fill grams per meter when variant changes ────────────────────────
  useEffect(() => {
    if (variantId) {
      const variant = variants.find((v) => v.id === variantId);
      if (variant) {
        setGramsPerMeter(String(variant.standardGramsPerMeter));
      }
    }
  }, [variantId, variants]);

  // ── Computed: electricity units ──────────────────────────────────────────
  const electricityUnits =
    electricityStart && electricityEnd
      ? Math.max(0, Number(electricityEnd) - Number(electricityStart))
      : 0;

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!plantId) errs.plantId = 'Plant is required';
    if (!date) errs.date = 'Date is required';
    if (workerIds.length === 0) errs.workerIds = 'Select at least one worker';
    if (!variantId) errs.variantId = 'Variant is required';
    if (!metersProduced || Number(metersProduced) <= 0)
      errs.metersProduced = 'Enter valid meters produced';
    if (!gramsPerMeter || Number(gramsPerMeter) <= 0)
      errs.gramsPerMeter = 'Enter valid grams per meter';
    if (!electricityStart && electricityStart !== '0')
      errs.electricityStart = 'Enter start reading';
    if (!electricityEnd && electricityEnd !== '0')
      errs.electricityEnd = 'Enter end reading';
    if (
      electricityStart &&
      electricityEnd &&
      Number(electricityEnd) < Number(electricityStart)
    )
      errs.electricityEnd = 'End reading must be ≥ start reading';
    if (!scrapWeightGrams && scrapWeightGrams !== '0')
      errs.scrapWeightGrams = 'Enter scrap weight';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [
    plantId,
    date,
    workerIds,
    variantId,
    metersProduced,
    gramsPerMeter,
    electricityStart,
    electricityEnd,
    scrapWeightGrams,
  ]);

  // ── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: CreateProductionEntryPayload) =>
      productionApi.createEntry(payload),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Production entry saved!' });
      refreshNotifications();
      setTimeout(() => navigate('/production'), 1500);
    },
    onError: (err: Error) => {
      setToast({
        type: 'error',
        message: err.message || 'Failed to save entry',
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    mutation.mutate({
      plantId,
      shift,
      date,
      workerIds,
      variantId,
      metersProduced: Number(metersProduced),
      gramsPerMeter: Number(gramsPerMeter),
      electricityUnitsConsumed: electricityUnits,
      electricityStartReading: electricityStart
        ? Number(electricityStart)
        : undefined,
      electricityEndReading: electricityEnd
        ? Number(electricityEnd)
        : undefined,
      scrapWeightGrams: Number(scrapWeightGrams),
    });
  };

  // ── Toast auto-dismiss ───────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (plantsLoading || variantsLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          New Production Entry
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Record shift production data
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Plant & Shift row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SearchableSelect
            label="Plant"
            options={plants.map((p) => ({ value: p.id, label: p.name }))}
            value={plantId}
            onChange={setPlantId}
            placeholder="Select plant..."
            error={errors.plantId}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Shift
            </label>
            <div className="flex gap-3">
              {(['DAY', 'NIGHT'] as Shift[]).map((s) => (
                <label
                  key={s}
                  className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    shift === s
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="shift"
                    value={s}
                    checked={shift === s}
                    onChange={() => setShift(s)}
                    className="sr-only"
                  />
                  {s === 'DAY' ? '☀️ Day' : '🌙 Night'}
                </label>
              ))}
            </div>
            {errors.shift && (
              <p className="mt-1 text-xs text-red-600">{errors.shift}</p>
            )}
          </div>
        </div>

        {/* Date */}
        <DatePicker
          label="Production Date"
          value={date}
          onChange={setDate}
          max={toISODate(new Date())}
          error={errors.date}
        />

        {/* Workers */}
        <WorkerMultiSelect
          label="Workers"
          options={workers.map((w) => ({ id: w.id, name: w.name }))}
          value={workerIds}
          onChange={setWorkerIds}
          disabled={!plantId || workersLoading}
          placeholder={
            !plantId
              ? 'Select a plant first...'
              : workersLoading
                ? 'Loading workers...'
                : 'Search workers...'
          }
          error={errors.workerIds}
        />

        {/* Variant */}
        <SearchableSelect
          label="Variant"
          options={variants.map((v) => ({
            value: v.id,
            label: `${v.code} – ${v.name}`,
          }))}
          value={variantId}
          onChange={setVariantId}
          placeholder="Select variant..."
          error={errors.variantId}
        />

        {/* Meters & Grams per meter */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Meters Produced
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={metersProduced}
              onChange={(e) => setMetersProduced(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                errors.metersProduced ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.metersProduced && (
              <p className="mt-1 text-xs text-red-600">
                {errors.metersProduced}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Grams per Meter
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
              <p className="mt-1 text-xs text-red-600">
                {errors.gramsPerMeter}
              </p>
            )}
          </div>
        </div>

        {/* Electricity readings */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-medium text-gray-700">
            Electricity Meter Readings
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Start Reading
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={electricityStart}
                onChange={(e) => setElectricityStart(e.target.value)}
                placeholder="0"
                min="0"
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  errors.electricityStart ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.electricityStart && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.electricityStart}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">
                End Reading
              </label>
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
                <p className="mt-1 text-xs text-red-600">
                  {errors.electricityEnd}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Units Consumed
              </label>
              <div className="flex min-h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
                {electricityUnits || '—'}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Scrap weight */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Scrap Weight (grams)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={scrapWeightGrams}
            onChange={(e) => setScrapWeightGrams(e.target.value)}
            placeholder="0"
            min="0"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              errors.scrapWeightGrams ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.scrapWeightGrams && (
            <p className="mt-1 text-xs text-red-600">
              {errors.scrapWeightGrams}
            </p>
          )}
        </div>

        {/* Submit */}
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
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:flex-none"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={16} />
                Save Entry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
