import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, ArrowLeft, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect, type SelectOption } from '../../components/forms/SearchableSelect';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  settingsApi,
  type Plant,
  type Machine,
  type Worker,
} from '../../services/settings.api';

// ─── Plant Edit Modal ───────────────────────────────────────────────────────

interface PlantFormProps {
  plant: Plant;
  onClose: () => void;
  onSuccess: () => void;
}

function PlantFormModal({ plant, onClose, onSuccess }: PlantFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plant.name);
  const [location, setLocation] = useState(plant.location ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Plant name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updatePlant(plant.id, {
        name: name.trim(),
        location: location.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-plants'] });
      setToast({ type: 'success', message: 'Plant updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update' });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title="Edit Plant" size="sm">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Plant Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" />Saving…</>
            ) : (
              'Update'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Machine Form Modal ─────────────────────────────────────────────────────

interface MachineFormProps {
  plantId: string;
  machine?: Machine | null;
  onClose: () => void;
  onSuccess: () => void;
}

function MachineFormModal({ plantId, machine, onClose, onSuccess }: MachineFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!machine;

  const [identifier, setIdentifier] = useState(machine?.identifier ?? '');
  const [kwhRating, setKwhRating] = useState(String(machine?.kwhRating ?? ''));
  const [expectedOutput, setExpectedOutput] = useState(
    machine?.expectedOutputPerShift != null ? String(machine.expectedOutputPerShift) : '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!identifier.trim()) errs.identifier = 'Identifier is required';
    const kwh = Number(kwhRating);
    if (isNaN(kwh) || kwh <= 0) errs.kwhRating = 'Must be a positive number';
    if (expectedOutput.trim()) {
      const eo = Number(expectedOutput);
      if (isNaN(eo) || eo <= 0) errs.expectedOutput = 'Must be a positive number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [identifier, kwhRating, expectedOutput]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createMachine(plantId, {
        identifier: identifier.trim(),
        kwhRating: Number(kwhRating),
        expectedOutputPerShift: expectedOutput.trim()
          ? Number(expectedOutput)
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-plants'] });
      setToast({ type: 'success', message: 'Machine added!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateMachine(plantId, machine!.id, {
        identifier: identifier.trim(),
        kwhRating: Number(kwhRating),
        expectedOutputPerShift: expectedOutput.trim()
          ? Number(expectedOutput)
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-plants'] });
      setToast({ type: 'success', message: 'Machine updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Machine' : 'Add Machine'} size="sm">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Identifier *</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.identifier ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="e.g. M-01"
          />
          {errors.identifier && <p className="mt-1 text-xs text-red-600">{errors.identifier}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">kWh Rating *</label>
          <input
            type="number"
            step="0.01"
            value={kwhRating}
            onChange={(e) => setKwhRating(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.kwhRating ? 'border-red-400' : 'border-gray-300'}`}
          />
          {errors.kwhRating && <p className="mt-1 text-xs text-red-600">{errors.kwhRating}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Expected Output / Shift
          </label>
          <input
            type="number"
            value={expectedOutput}
            onChange={(e) => setExpectedOutput(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.expectedOutput ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="Optional"
          />
          {errors.expectedOutput && (
            <p className="mt-1 text-xs text-red-600">{errors.expectedOutput}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 size={16} className="animate-spin" />Saving…</>
            ) : isEdit ? (
              'Update'
            ) : (
              'Add'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Worker Form Modal ──────────────────────────────────────────────────────

interface WorkerFormProps {
  worker?: Worker | null;
  plantOptions: SelectOption[];
  onClose: () => void;
  onSuccess: () => void;
}

function WorkerFormModal({ worker, plantOptions, onClose, onSuccess }: WorkerFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!worker;

  const [name, setName] = useState(worker?.name ?? '');
  const [designation, setDesignation] = useState(worker?.designation ?? '');
  const [plantId, setPlantId] = useState(worker?.plantId ?? '');
  const [isActive, setIsActive] = useState(worker?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Worker name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name]);

  const createMutation = useMutation({
    mutationFn: () =>
      settingsApi.createWorker({
        name: name.trim(),
        designation: designation.trim() || undefined,
        plantId: plantId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-workers'] });
      setToast({ type: 'success', message: 'Worker created!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to create' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateWorker(worker!.id, {
        name: name.trim(),
        designation: designation.trim() || null,
        plantId: plantId || null,
        isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-workers'] });
      setToast({ type: 'success', message: 'Worker updated!' });
      setTimeout(onSuccess, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to update' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Worker' : 'Add Worker'} size="sm">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            placeholder="Worker name"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Designation</label>
          <input
            type="text"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. Operator"
          />
        </div>
        <SearchableSelect
          label="Plant"
          options={plantOptions}
          value={plantId}
          onChange={setPlantId}
          placeholder="Unassigned"
          clearable
        />
        {isEdit && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Active
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <><Loader2 size={16} className="animate-spin" />Saving…</>
            ) : isEdit ? (
              'Update'
            ) : (
              'Add'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Plant Card ─────────────────────────────────────────────────────────────

interface PlantCardProps {
  plant: Plant;
  expanded: boolean;
  onToggle: () => void;
  onEditPlant: () => void;
  onAddMachine: () => void;
  onEditMachine: (m: Machine) => void;
}

function PlantCard({
  plant,
  expanded,
  onToggle,
  onEditPlant,
  onAddMachine,
  onEditMachine,
}: PlantCardProps) {
  return (
    <div className="rounded-lg border bg-white">
      {/* Plant header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{plant.name}</h3>
          {plant.location && (
            <p className="text-xs text-gray-500">{plant.location}</p>
          )}
        </div>
        <span className="mr-2 text-xs text-gray-400">
          {plant.machines.length} machine{plant.machines.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onEditPlant}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
          title="Edit plant"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* Machines */}
      {expanded && (
        <div className="border-t bg-gray-50 px-4 py-3">
          {plant.machines.length === 0 ? (
            <p className="text-xs text-gray-400">No machines registered</p>
          ) : (
            <div className="space-y-2">
              {plant.machines.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {m.identifier}
                    </span>
                    <span className="ml-3 text-xs text-gray-500">
                      {m.kwhRating} kWh
                    </span>
                    {m.expectedOutputPerShift != null && (
                      <span className="ml-3 text-xs text-gray-500">
                        ~{m.expectedOutputPerShift}/shift
                      </span>
                    )}
                    {!m.isActive && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onEditMachine(m)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onAddMachine}
            className="mt-3 flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />
            Add Machine
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PlantWorkerManagement() {
  const navigate = useNavigate();

  // Plants state
  const [expandedPlant, setExpandedPlant] = useState<string | null>(null);
  const [editPlant, setEditPlant] = useState<Plant | null>(null);
  const [machineForm, setMachineForm] = useState<{
    plantId: string;
    machine?: Machine;
  } | null>(null);

  // Workers state
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);

  const { data: plantsResp, isLoading: loadingPlants } = useQuery({
    queryKey: ['settings-plants'],
    queryFn: settingsApi.getPlants,
  });

  const { data: workersResp, isLoading: loadingWorkers } = useQuery({
    queryKey: ['settings-workers'],
    queryFn: settingsApi.getWorkers,
  });

  const plants = plantsResp?.data ?? [];
  const workers = workersResp?.data ?? [];

  const plantOptions: SelectOption[] = plants.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  // ── Worker columns ──────────────────────────────────────────────────────
  const workerColumns: Column<Worker>[] = [
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'designation',
      header: 'Designation',
      hideOnMobile: true,
      render: (row) => row.designation || '—',
    },
    {
      key: 'plant',
      header: 'Plant',
      render: (row) => row.plant?.name ?? 'Unassigned',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <span className="flex items-center gap-1.5 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${row.isActive ? 'bg-green-500' : 'bg-red-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditWorker(row);
          }}
          className="min-h-[44px] rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          Edit
        </button>
      ),
    },
  ];

  const workerMobileCard = (row: Worker) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
        <button
          onClick={() => setEditWorker(row)}
          className="min-h-[44px] text-xs text-blue-600"
        >
          Edit
        </button>
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        {row.designation && <span>{row.designation}</span>}
        <span>{row.plant?.name ?? 'Unassigned'}</span>
        <span className="flex items-center gap-1">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-green-500' : 'bg-red-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  );

  const isLoading = loadingPlants || loadingWorkers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Plants & Workers
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage plants, machines, and worker assignments
          </p>
        </div>
      </div>

      {/* Plants Section */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Plants</h2>
        <div className="space-y-3">
          {plants.length === 0 ? (
            <div className="rounded-lg border bg-white px-4 py-8 text-center text-sm text-gray-400">
              No plants configured
            </div>
          ) : (
            plants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                expanded={expandedPlant === plant.id}
                onToggle={() =>
                  setExpandedPlant(expandedPlant === plant.id ? null : plant.id)
                }
                onEditPlant={() => setEditPlant(plant)}
                onAddMachine={() =>
                  setMachineForm({ plantId: plant.id })
                }
                onEditMachine={(m) =>
                  setMachineForm({ plantId: plant.id, machine: m })
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Workers Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Workers</h2>
          <button
            onClick={() => setShowWorkerForm(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Worker
          </button>
        </div>
        <div className="rounded-lg border bg-white">
          <DataTable
            columns={workerColumns}
            data={workers}
            isLoading={loadingWorkers}
            keyExtractor={(row) => row.id}
            mobileCard={workerMobileCard}
            emptyMessage="No workers registered"
          />
        </div>
      </div>

      {/* Modals */}
      {editPlant && (
        <PlantFormModal
          plant={editPlant}
          onClose={() => setEditPlant(null)}
          onSuccess={() => setEditPlant(null)}
        />
      )}

      {machineForm && (
        <MachineFormModal
          plantId={machineForm.plantId}
          machine={machineForm.machine}
          onClose={() => setMachineForm(null)}
          onSuccess={() => setMachineForm(null)}
        />
      )}

      {showWorkerForm && (
        <WorkerFormModal
          plantOptions={plantOptions}
          onClose={() => setShowWorkerForm(false)}
          onSuccess={() => setShowWorkerForm(false)}
        />
      )}

      {editWorker && (
        <WorkerFormModal
          worker={editWorker}
          plantOptions={plantOptions}
          onClose={() => setEditWorker(null)}
          onSuccess={() => setEditWorker(null)}
        />
      )}
    </div>
  );
}
