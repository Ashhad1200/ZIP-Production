import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import platformApi from '../../services/platform.api';
import { DataTable, Modal, type Column } from '../../components/ui';
import { formatPaisaToRupees, parseDisplayToPaisa } from '../../utils/currency';

interface ModuleRow {
  id: string;
  key: string;
  name: string;
}

interface PlanRow {
  id: string;
  name: string;
  code: string;
  pricePaisa: string;
  billingCycleDays: number;
  trialDays: number;
  maxSubCompanies: number;
  isActive: boolean;
  planModules: { module: ModuleRow }[];
}

export function PlansPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: plans, isLoading } = useQuery<PlanRow[]>({
    queryKey: ['platform', 'plans'],
    queryFn: async () => (await platformApi.get<{ data: PlanRow[] }>('/plans')).data.data,
  });

  const { data: modules } = useQuery<ModuleRow[]>({
    queryKey: ['platform', 'modules'],
    queryFn: async () => (await platformApi.get<{ data: ModuleRow[] }>('/modules')).data.data,
  });

  const columns: Column<PlanRow>[] = [
    { key: 'name', header: 'Plan' },
    { key: 'price', header: 'Price', render: (row) => `${formatPaisaToRupees(Number(row.pricePaisa))} / ${row.billingCycleDays}d` },
    { key: 'trialDays', header: 'Trial', render: (row) => `${row.trialDays}d` },
    { key: 'maxSubCompanies', header: 'Max Sub-Companies' },
    { key: 'modules', header: 'Modules', hideOnMobile: true, render: (row) => row.planModules.map((pm) => pm.module.name).join(', ') },
    { key: 'isActive', header: 'Active', render: (row) => (row.isActive ? 'Yes' : 'No') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500">What you sell — price, modules, sub-company limit</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New Plan
        </button>
      </div>

      <div className="rounded-xl border bg-white">
        <DataTable columns={columns} data={plans ?? []} isLoading={isLoading} keyExtractor={(row) => row.id} emptyMessage="No plans yet" />
      </div>

      <CreatePlanModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        modules={modules ?? []}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
          setIsCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreatePlanModal({
  open,
  onClose,
  modules,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  modules: ModuleRow[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [billingCycleDays, setBillingCycleDays] = useState(30);
  const [trialDays, setTrialDays] = useState(3);
  const [maxSubCompanies, setMaxSubCompanies] = useState(1);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await platformApi.post('/plans', {
        name,
        code,
        pricePaisa: parseDisplayToPaisa(price),
        billingCycleDays,
        trialDays,
        maxSubCompanies,
        moduleKeys: selectedModules,
      });
    },
    onSuccess: () => {
      toast.success('Plan created');
      onCreated();
    },
    onError: () => toast.error('Failed to create plan'),
  });

  const toggleModule = (key: string) => {
    setSelectedModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Plan"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || !code || !price || createMutation.isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Plan'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </Field>
          <Field label="Code (unique, e.g. 'standard')">
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </Field>
          <Field label="Price (e.g. '15000' or '15K')">
            <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </Field>
          <Field label="Billing cycle (days)">
            <input
              type="number"
              value={billingCycleDays}
              onChange={(e) => setBillingCycleDays(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </Field>
          <Field label="Trial (days)">
            <input type="number" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2" />
          </Field>
          <Field label="Max sub-companies">
            <input
              type="number"
              value={maxSubCompanies}
              onChange={(e) => setMaxSubCompanies(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Modules included</p>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedModules.includes(m.key)} onChange={() => toggleModule(m.key)} />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
