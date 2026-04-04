import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  DollarSign,
  CreditCard,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { hrApi, type WorkerSalaryInfo, type WorkerAdvance, type PayrollRecord, type CreatePayrollPayload } from '../../services/hr.api';
import { formatDatePKT } from '../../utils/date';

type Tab = 'workers' | 'payroll' | 'advances';

// ── helpers ──────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div
      className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
    >
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 font-bold">×</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

// ── Workers tab ───────────────────────────────────────────────────────────────
function WorkersTab() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rate, setRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-workers'],
    queryFn: () => hrApi.listWorkers().then((r) => r.data),
  });

  const setRateMut = useMutation({
    mutationFn: ({ id, r, d }: { id: string; r: number; d: string }) =>
      hrApi.setSalaryRate(id, { dailyRate: r, effectiveDate: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-workers'] });
      setEditingId(null);
      setToast({ msg: 'Salary rate updated', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    },
    onError: () => {
      setToast({ msg: 'Failed to update rate', type: 'error' });
      setTimeout(() => setToast(null), 3500);
    },
  });

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Workers & Salary Rates</h2>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Worker</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Daily Rate (PKR)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Effective From</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data ?? []).map((w: WorkerSalaryInfo) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{w.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === w.id ? (
                      <input
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        className={`${inputCls} w-28 text-right`}
                        placeholder="0"
                        min={0}
                      />
                    ) : (
                      <span className={w.currentRate ? 'font-medium' : 'text-gray-400'}>
                        {w.currentRate != null ? Number(w.currentRate).toLocaleString() : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {editingId === w.id ? (
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        className={inputCls}
                      />
                    ) : (
                      w.rateEffectiveDate ? formatDatePKT(w.rateEffectiveDate) : '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === w.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setRateMut.mutate({ id: w.id, r: Number(rate), d: effectiveDate })}
                          disabled={setRateMut.isPending || !rate}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(w.id);
                          setRate(w.currentRate != null ? String(w.currentRate) : '');
                          setEffectiveDate(new Date().toISOString().slice(0, 10));
                        }}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Set Rate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No workers found. Add workers in Settings → Workers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Payroll tab ───────────────────────────────────────────────────────────────
function PayrollTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Workers for select
  const { data: workers } = useQuery({
    queryKey: ['hr-workers'],
    queryFn: () => hrApi.listWorkers().then((r) => r.data),
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ['hr-payroll', filterYear, filterMonth],
    queryFn: () =>
      hrApi.listPayroll({ year: Number(filterYear), month: Number(filterMonth) }).then((r) => r.data),
  });

  // Summary
  const { data: summary } = useQuery({
    queryKey: ['hr-payroll-summary', filterYear, filterMonth],
    queryFn: () => hrApi.getMonthlySummary(Number(filterYear), Number(filterMonth)).then((r) => r.data),
    enabled: !!(filterYear && filterMonth),
  });

  // Payroll form state
  const [form, setForm] = useState<Partial<CreatePayrollPayload>>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    deductions: 0,
    advanceDeduction: 0,
    paymentMode: 'CASH',
  });

  const createMut = useMutation({
    mutationFn: (p: CreatePayrollPayload) => hrApi.createPayroll(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll'] });
      qc.invalidateQueries({ queryKey: ['hr-payroll-summary'] });
      setShowForm(false);
      setToast({ msg: 'Payroll processed successfully', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to process payroll';
      setToast({ msg, type: 'error' });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-800">Payroll</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={15} /> Run Payroll
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className={`${inputCls} flex-1`}
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className={`${inputCls} w-28`}
          min={2020}
          max={2099}
        />
      </div>

      {/* Summary card */}
      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Workers', val: summary.totalWorkers },
            { label: 'Gross', val: `PKR ${Number(summary.totalGross).toLocaleString()}` },
            { label: 'Deductions', val: `PKR ${Number(summary.totalDeductions).toLocaleString()}` },
            { label: 'Net Paid', val: `PKR ${Number(summary.totalNet).toLocaleString()}` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="mt-0.5 text-base font-bold text-gray-900">{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Worker</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 hidden sm:table-cell">Deductions</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 hidden sm:table-cell">Advance Ded.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Net</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Journal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(records ?? []).map((r: PayrollRecord) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.worker.name}</td>
                  <td className="px-4 py-3 text-right">{Number(r.grossSalary).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-600 hidden sm:table-cell">{Number(r.deductions).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-600 hidden sm:table-cell">{Number(r.advanceDeduction).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{Number(r.netSalary).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">{r.journalEntry?.entryNumber ?? '—'}</td>
                </tr>
              ))}
              {!records?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No payroll records for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payroll form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Run Payroll</h3>
            <div className="space-y-4">
              <Field label="Worker *">
                <select
                  value={form.workerId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, workerId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select worker…</option>
                  {(workers ?? []).map((w: WorkerSalaryInfo) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Month *">
                  <select
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                    className={inputCls}
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Year *">
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                    className={inputCls}
                    min={2020}
                    max={2099}
                  />
                </Field>
              </div>
              <Field label="Gross Salary (PKR) *">
                <input
                  type="number"
                  value={form.grossSalary ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, grossSalary: Number(e.target.value) }))}
                  className={inputCls}
                  min={0}
                  placeholder="0"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deductions (PKR)">
                  <input
                    type="number"
                    value={form.deductions ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, deductions: Number(e.target.value) }))}
                    className={inputCls}
                    min={0}
                  />
                </Field>
                <Field label="Advance Deduction (PKR)">
                  <input
                    type="number"
                    value={form.advanceDeduction ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, advanceDeduction: Number(e.target.value) }))}
                    className={inputCls}
                    min={0}
                  />
                </Field>
              </div>
              <Field label="Payment Mode">
                <select
                  value={form.paymentMode ?? 'CASH'}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                  className={inputCls}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!form.workerId || !form.grossSalary) return;
                  createMut.mutate(form as CreatePayrollPayload);
                }}
                disabled={createMut.isPending || !form.workerId || !form.grossSalary}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMut.isPending ? 'Processing…' : 'Process Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Advances tab ──────────────────────────────────────────────────────────────
function AdvancesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [filterRecovered, setFilterRecovered] = useState<boolean | undefined>(undefined);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const { data: workers } = useQuery({
    queryKey: ['hr-workers'],
    queryFn: () => hrApi.listWorkers().then((r) => r.data),
  });

  const { data: advances, isLoading } = useQuery({
    queryKey: ['hr-advances', filterRecovered],
    queryFn: () =>
      hrApi.listAdvances(filterRecovered !== undefined ? { recovered: filterRecovered } : undefined)
        .then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => hrApi.createAdvance(selectedWorker, { amount: Number(amount), date, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-advances'] });
      setShowForm(false);
      setAmount('');
      setReason('');
      setSelectedWorker('');
      setToast({ msg: 'Advance issued', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    },
    onError: () => {
      setToast({ msg: 'Failed to issue advance', type: 'error' });
      setTimeout(() => setToast(null), 3500);
    },
  });

  const recoverMut = useMutation({
    mutationFn: (id: string) => hrApi.markAdvanceRecovered(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-advances'] });
      setToast({ msg: 'Advance marked as recovered', type: 'success' });
      setTimeout(() => setToast(null), 3500);
    },
    onError: () => {
      setToast({ msg: 'Failed to mark recovered', type: 'error' });
      setTimeout(() => setToast(null), 3500);
    },
  });

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-800">Worker Advances</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={15} /> Issue Advance
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-3">
        {([
          [undefined, 'All'],
          [false, 'Pending Recovery'],
          [true, 'Recovered'],
        ] as [boolean | undefined, string][]).map(([val, label]) => (
          <button
            key={label}
            onClick={() => setFilterRecovered(val)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filterRecovered === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Worker</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(advances ?? []).map((a: WorkerAdvance) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.worker.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(a.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatDatePKT(a.date)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.isRecovered ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle2 size={11} /> Recovered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!a.isRecovered && (
                      <button
                        onClick={() => recoverMut.mutate(a.id)}
                        disabled={recoverMut.isPending}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                      >
                        Mark Recovered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!advances?.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    No advances found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue advance modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Issue Advance</h3>
            <div className="space-y-4">
              <Field label="Worker *">
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select worker…</option>
                  {(workers ?? []).map((w: WorkerSalaryInfo) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount (PKR) *">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  min={0}
                  placeholder="0"
                />
              </Field>
              <Field label="Date *">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Reason">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputCls}
                  placeholder="Optional reason"
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !selectedWorker || !amount}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMut.isPending ? 'Saving…' : 'Issue Advance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HRPage ────────────────────────────────────────────────────────────────────
export default function HRPage() {  const [tab, setTab] = useState<Tab>('workers');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'workers', label: 'Workers & Rates', icon: <Users size={16} /> },
    { id: 'payroll', label: 'Payroll', icon: <DollarSign size={16} /> },
    { id: 'advances', label: 'Advances', icon: <CreditCard size={16} /> },
  ];

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">HR & Payroll</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage worker salary rates, advances, and monthly payroll
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workers' && <WorkersTab />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'advances' && <AdvancesTab />}
    </div>
  );
}


