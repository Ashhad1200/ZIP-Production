import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Loader2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { DatePicker } from '../../components/forms/DatePicker';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { toISODate } from '../../utils/date';
import {
  productionApi,
  type Shift,
  type CreateProductionEntryPayload,
  type WorkerAssignmentPayload,
} from '../../services/production.api';

interface FormErrors {
  plantId?: string;
  date?: string;
  variantId?: string;
  electricityStart?: string;
}

export function ProductionEntryForm() {
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();

  // ── Form state ───────────────────────────────────────────────────────────
  const [plantId, setPlantId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [shift, setShift] = useState<Shift>('DAY');
  const [date, setDate] = useState(toISODate(new Date()));
  const [headOperatorId, setHeadOperatorId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [electricityStart, setElectricityStart] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Reference data queries ───────────────────────────────────────────────
  const { data: plantsResp, isLoading: plantsLoading } = useQuery({
    queryKey: ['plants'],
    queryFn: productionApi.getPlants,
  });
  const plants = plantsResp?.data ?? [];

  const selectedPlant = plants.find((p) => p.id === plantId);
  const machines = selectedPlant?.machines ?? [];

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

  // ── Default single plant ─────────────────────────────────────────────────
  useEffect(() => {
    if (plants.length === 1 && plants[0] && !plantId) {
      setPlantId(plants[0].id);
    }
  }, [plants, plantId]);

  useEffect(() => {
    setMachineId('');
    setHeadOperatorId('');
    setAssistantId('');
  }, [plantId]);

  useEffect(() => {
    if (machines.length === 1 && machines[0] && !machineId) {
      setMachineId(machines[0].id);
    }
  }, [machines, machineId]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!plantId) errs.plantId = 'Plant is required';
    if (!date) errs.date = 'Date is required';
    if (!variantId) errs.variantId = 'Variant is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [plantId, date, variantId]);

  // ── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: CreateProductionEntryPayload) =>
      productionApi.createEntry(payload),
    onSuccess: () => {
      setToast({ type: 'success', message: 'Production started! Complete it when the shift ends.' });
      refreshNotifications();
      setTimeout(() => navigate('/production'), 1800);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to start production' });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const workerAssignments: WorkerAssignmentPayload[] = [];
    if (headOperatorId) workerAssignments.push({ workerId: headOperatorId, role: 'HEAD_OPERATOR' });
    if (assistantId) workerAssignments.push({ workerId: assistantId, role: 'ASSISTANT' });

    mutation.mutate({
      plantId,
      machineId: machineId || undefined,
      shift,
      date,
      variantId,
      electricityStartReading: electricityStart ? Number(electricityStart) : undefined,
      workers: workerAssignments.length > 0 ? workerAssignments : undefined,
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (plantsLoading || variantsLoading) return <LoadingSpinner />;

  const workerOptions = workers.map((w) => ({ value: w.id, label: w.name + (w.designation ? ` (${w.designation})` : '') }));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Start Production</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record a single variant run. Start another entry for the next variant.
        </p>
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift</label>
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
          </div>
        </div>

        {/* Machine */}
        {plantId && machines.length > 0 && (
          <SearchableSelect
            label="Machine (optional)"
            options={machines.map((m) => ({ value: m.id, label: m.identifier }))}
            value={machineId}
            onChange={setMachineId}
            placeholder="Select machine (3D Chakra / Glass Chakra)..."
          />
        )}

        {/* Date */}
        <DatePicker
          label="Production Date"
          value={date}
          onChange={setDate}
          max={toISODate(new Date())}
          error={errors.date}
        />

        {/* Variant — single select */}
        <SearchableSelect
          label="Variant to Produce"
          options={variants.map((v) => ({ value: v.id, label: `${v.code} – ${v.name}` }))}
          value={variantId}
          onChange={setVariantId}
          placeholder="Select variant..."
          error={errors.variantId}
        />

        {/* Workers */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-medium text-gray-700">Shift Workers (optional)</legend>
          <div className="space-y-3">
            <SearchableSelect
              label="Head Operator"
              options={workerOptions}
              value={headOperatorId}
              onChange={setHeadOperatorId}
              placeholder={!plantId ? 'Select a plant first…' : workersLoading ? 'Loading…' : 'Select head operator…'}
              disabled={!plantId || workersLoading}
            />
            <SearchableSelect
              label="Assistant"
              options={workerOptions}
              value={assistantId}
              onChange={setAssistantId}
              placeholder={!plantId ? 'Select a plant first…' : workersLoading ? 'Loading…' : 'Select assistant…'}
              disabled={!plantId || workersLoading}
            />
          </div>
        </fieldset>

        {/* Electricity start reading */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-medium text-gray-700">Electricity Meter (optional)</legend>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Start Reading</label>
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
          </div>
        </fieldset>

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
                Starting…
              </>
            ) : (
              <>
                <Play size={16} />
                Start Production
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
