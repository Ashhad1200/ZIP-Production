import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Building2, Truck, Package, MoreHorizontal, Users } from 'lucide-react';
import {
  monthlyOverheadApi,
  type MonthlyOverheadDisplay,
  type MonthlyOverheadInput,
} from '../../services/monthly-overhead.api';
import { LoadingSpinner } from '../../components/ui';
import { parseDisplayToPaisa } from '../../utils/currency';

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const amountFieldKeys = [
  'laborPaisa',
  'rentPaisa',
  'transportationPaisa',
  'packingPaisa',
  'miscellaneousPaisa',
] as const;

type AmountFieldKey = (typeof amountFieldKeys)[number];
type AmountInputState = Record<AmountFieldKey, string>;

function emptyForm(): MonthlyOverheadInput {
  return {
    year: currentYear,
    month: currentMonth,
    laborPaisa: 0,
    rentPaisa: 0,
    transportationPaisa: 0,
    packingPaisa: 0,
    miscellaneousPaisa: 0,
    notes: '',
  };
}

function paisaToPkr(paisa: string | number): string {
  return (Number(paisa) / 100).toFixed(2);
}

function getAmountInputs(overhead: Pick<MonthlyOverheadInput, AmountFieldKey>): AmountInputState {
  return {
    laborPaisa: paisaToPkr(overhead.laborPaisa),
    rentPaisa: paisaToPkr(overhead.rentPaisa),
    transportationPaisa: paisaToPkr(overhead.transportationPaisa),
    packingPaisa: paisaToPkr(overhead.packingPaisa),
    miscellaneousPaisa: paisaToPkr(overhead.miscellaneousPaisa),
  };
}

export function MonthlyOverheadPage() {
  const qc = useQueryClient();
  const initialForm = emptyForm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MonthlyOverheadInput>(initialForm);
  const [amountInputs, setAmountInputs] = useState<AmountInputState>(
    getAmountInputs(initialForm),
  );
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-overheads', page],
    queryFn: () => monthlyOverheadApi.list({ page, limit: 24 }),
  });

  const upsertMutation = useMutation({
    mutationFn: monthlyOverheadApi.upsert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-overheads'] });
      qc.invalidateQueries({ queryKey: ['cost-price'] });
      setShowForm(false);
      const nextForm = emptyForm();
      setForm(nextForm);
      setAmountInputs(getAmountInputs(nextForm));
      setError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: monthlyOverheadApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly-overheads'] });
      qc.invalidateQueries({ queryKey: ['cost-price'] });
    },
  });

  function handleEdit(record: MonthlyOverheadDisplay) {
    const nextForm: MonthlyOverheadInput = {
      year: record.year,
      month: record.month,
      laborPaisa: Number(record.laborPaisa),
      rentPaisa: Number(record.rentPaisa),
      transportationPaisa: Number(record.transportationPaisa),
      packingPaisa: Number(record.packingPaisa),
      miscellaneousPaisa: Number(record.miscellaneousPaisa),
      notes: record.notes ?? '',
    };
    setForm(nextForm);
    setAmountInputs(getAmountInputs(nextForm));
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    upsertMutation.mutate({
      ...form,
      laborPaisa: parseDisplayToPaisa(amountInputs.laborPaisa),
      rentPaisa: parseDisplayToPaisa(amountInputs.rentPaisa),
      transportationPaisa: parseDisplayToPaisa(amountInputs.transportationPaisa),
      packingPaisa: parseDisplayToPaisa(amountInputs.packingPaisa),
      miscellaneousPaisa: parseDisplayToPaisa(amountInputs.miscellaneousPaisa),
    });
  }

  const fields: { key: AmountFieldKey; label: string; icon: React.ReactNode }[] = [
    { key: 'laborPaisa', label: 'Labor', icon: <Users size={16} /> },
    { key: 'rentPaisa', label: 'Rent', icon: <Building2 size={16} /> },
    { key: 'transportationPaisa', label: 'Transportation', icon: <Truck size={16} /> },
    { key: 'packingPaisa', label: 'Packing', icon: <Package size={16} /> },
    { key: 'miscellaneousPaisa', label: 'Miscellaneous', icon: <MoreHorizontal size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Overhead</h1>
          <p className="text-sm text-gray-500">
            Monthly fixed costs distributed per meter for cost price calculation
          </p>
        </div>
        <button
          onClick={() => {
            const nextForm = emptyForm();
            setForm(nextForm);
            setAmountInputs(getAmountInputs(nextForm));
            setShowForm(true);
            setError('');
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Add / Update Month
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Set Monthly Overhead Costs
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Month / Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Month</label>
                <select
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {MONTHS.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cost fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(({ key, label, icon }) => (
                <div key={key}>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    {icon} {label} <span className="text-gray-400">(PKR / month)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountInputs[key]}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '');
                      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                        setAmountInputs((prev) => ({ ...prev, [key]: value }));
                      }
                    }}
                    onBlur={() =>
                      setAmountInputs((prev) => ({
                        ...prev,
                        [key]: paisaToPkr(parseDisplayToPaisa(prev[key])),
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="e.g. Includes Eid bonus for labor"
              />
            </div>

            {/* Total preview */}
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm">
              <span className="text-gray-600">Total monthly overhead: </span>
              <span className="font-bold text-blue-700">
                PKR{' '}
                {(
                  (parseDisplayToPaisa(amountInputs.laborPaisa) +
                    parseDisplayToPaisa(amountInputs.rentPaisa) +
                    parseDisplayToPaisa(amountInputs.transportationPaisa) +
                    parseDisplayToPaisa(amountInputs.packingPaisa) +
                    parseDisplayToPaisa(amountInputs.miscellaneousPaisa)) /
                  100
                ).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={upsertMutation.isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {upsertMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <LoadingSpinner />}

      {/* Table */}
      {data && (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Month</th>
                  <th className="px-4 py-3 text-right">Labor</th>
                  <th className="px-4 py-3 text-right">Rent</th>
                  <th className="px-4 py-3 text-right">Transport</th>
                  <th className="px-4 py-3 text-right">Packing</th>
                  <th className="px-4 py-3 text-right">Misc</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No monthly overhead entries yet. Add one to improve cost accuracy.
                    </td>
                  </tr>
                )}
                {data.data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.monthLabel}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.laborDisplay}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.rentDisplay}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.transportationDisplay}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.packingDisplay}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.miscellaneousDisplay}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{row.totalDisplay}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(row)}
                          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete overhead for ${row.monthLabel}?`)) {
                              deleteMutation.mutate(row.id);
                            }
                          }}
                          className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-gray-600">
              <span>Page {data.meta.page} of {data.meta.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
                <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">How overhead is allocated</p>
        <p className="mt-1 text-blue-700">
          The total monthly overhead is divided equally across all meters produced in that month.
          <br />
          <strong>Overhead/meter = Total monthly overhead ÷ Total meters produced (month)</strong>
          <br />
          This is then added to each shift's electricity + raw material + labor cost per meter.
        </p>
      </div>
    </div>
  );
}
