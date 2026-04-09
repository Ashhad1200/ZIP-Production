import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { salesReturnApi, type SalesReturn, type CreateSalesReturnLineItemInput } from '../../services/sales-return.api';
import { gatePassApi } from '../../services/gate-pass.api';
import { LoadingSpinner, EmptyState } from '../../components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB');
}

// ─── Line state per gate-pass line item ──────────────────────────────────────

interface LineState {
  gatePassLineItemId: string;
  checked: boolean;
  metersReturned: string;
}

// ─── Return Form ──────────────────────────────────────────────────────────────

function CreateReturnForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [gatePassId, setGatePassId] = useState('');
  const [gatePassInput, setGatePassInput] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [lineStates, setLineStates] = useState<LineState[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent gate passes for search
  const { data: gpResp, isLoading: gpLoading } = useQuery({
    queryKey: ['gp-lookup-for-return'],
    queryFn: () => gatePassApi.list({ limit: 100, sortBy: 'date', sortOrder: 'desc' }),
  });

  const gpOptions = useMemo(
    () =>
      (gpResp?.data ?? []).filter(
        (gp) =>
          !gatePassInput ||
          gp.gatePassNumber.toLowerCase().includes(gatePassInput.toLowerCase()) ||
          gp.client.name.toLowerCase().includes(gatePassInput.toLowerCase()),
      ),
    [gpResp, gatePassInput],
  );

  // Fetch full detail when a gate pass is selected
  const { data: gpDetail, isLoading: gpDetailLoading } = useQuery({
    queryKey: ['gp-detail', gatePassId],
    queryFn: () => gatePassApi.getById(gatePassId),
    enabled: !!gatePassId,
  });

  const selectedGP = gpDetail?.data;

  // When gate pass changes, initialise one LineState per line item (all unchecked)
  const handleSelectGP = (id: string, number: string) => {
    setGatePassId(id);
    setGatePassInput(number);
    setLineStates([]);
    setError(null);
  };

  // Initialise line states once GP detail loads
  const initLineStates = (lineItems: typeof selectedGP extends undefined ? never : NonNullable<typeof selectedGP>['lineItems']) => {
    if (lineStates.length === 0 && lineItems.length > 0) {
      setLineStates(lineItems.map((li) => ({ gatePassLineItemId: li.id, checked: false, metersReturned: '' })));
    }
  };

  if (selectedGP && lineStates.length === 0) {
    initLineStates(selectedGP.lineItems);
  }

  // Checkbox toggle
  const toggleLine = (id: string) => {
    setLineStates((prev) =>
      prev.map((ls) =>
        ls.gatePassLineItemId === id ? { ...ls, checked: !ls.checked, metersReturned: ls.checked ? '' : ls.metersReturned } : ls,
      ),
    );
  };

  // Select / deselect all
  const allChecked = lineStates.length > 0 && lineStates.every((ls) => ls.checked);
  const toggleAll = () => {
    setLineStates((prev) => prev.map((ls) => ({ ...ls, checked: !allChecked })));
  };

  // Meters input change
  const setMeters = (id: string, value: string) => {
    setLineStates((prev) =>
      prev.map((ls) => (ls.gatePassLineItemId === id ? { ...ls, metersReturned: value } : ls)),
    );
  };

  // Live total: sum of (rate × meters) for all checked + filled lines
  const liveTotal = useMemo(() => {
    if (!selectedGP) return null;
    let total = 0;
    for (const ls of lineStates) {
      if (!ls.checked || !ls.metersReturned) continue;
      const meters = parseInt(ls.metersReturned, 10);
      if (isNaN(meters) || meters <= 0) continue;
      const li = selectedGP.lineItems.find((l) => l.id === ls.gatePassLineItemId);
      if (li) total += (Number(BigInt(li.ratePerMeterPaisa) * BigInt(meters))) / 100;
    }
    return total;
  }, [lineStates, selectedGP]);

  const mutation = useMutation({
    mutationFn: salesReturnApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      onClose();
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      setError(err.response?.data?.error?.message ?? err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedLines: CreateSalesReturnLineItemInput[] = lineStates
      .filter((ls) => ls.checked && ls.metersReturned)
      .map((ls) => ({
        gatePassLineItemId: ls.gatePassLineItemId,
        metersReturned: parseInt(ls.metersReturned, 10),
      }))
      .filter((ls) => ls.metersReturned > 0);

    if (parsedLines.length === 0) {
      setError('Select at least one variant and enter the meters to return.');
      return;
    }

    // Client-side validation: meters ≤ original
    for (const pl of parsedLines) {
      const li = selectedGP!.lineItems.find((l) => l.id === pl.gatePassLineItemId);
      if (li && pl.metersReturned > li.meters) {
        setError(`Cannot return ${pl.metersReturned}m for ${li.variant.name} — only ${li.meters}m were dispatched.`);
        return;
      }
    }

    mutation.mutate({ gatePassId, date, reason: reason || undefined, lineItems: parsedLines });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-900">New Sales Return</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="return-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Gate Pass Search */}
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-700">Gate Pass *</label>
              <input
                type="text"
                value={gatePassInput}
                onChange={(e) => { setGatePassInput(e.target.value); setGatePassId(''); setLineStates([]); setError(null); }}
                placeholder="Type GP number or client name…"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />
              {gpLoading && <p className="mt-1 text-xs text-gray-400">Loading gate passes…</p>}
              {!gatePassId && gatePassInput && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {gpOptions.slice(0, 8).map((gp) => (
                    <li
                      key={gp.id}
                      onClick={() => handleSelectGP(gp.id, gp.gatePassNumber)}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                    >
                      <span className="font-medium text-blue-700">{gp.gatePassNumber}</span>
                      <span className="ml-2 text-gray-500">{gp.client.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{formatDate(gp.date)}</span>
                    </li>
                  ))}
                  {gpOptions.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-400">No gate passes found</li>
                  )}
                </ul>
              )}
            </div>

            {/* Date + Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Return Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Defective batch"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Variants Table */}
            {gpDetailLoading && (
              <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            )}

            {selectedGP && lineStates.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Variants from <span className="text-blue-700">{selectedGP.gatePassNumber}</span>
                    <span className="ml-1 text-gray-400">({selectedGP.client.name})</span>
                  </p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {allChecked ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Header row */}
                <div className="mb-1 grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <span></span>
                  <span>Variant</span>
                  <span className="text-right">Dispatched</span>
                  <span className="text-right">Rate/m</span>
                  <span className="text-right w-28">Return (m)</span>
                </div>

                <div className="divide-y rounded-xl border bg-gray-50">
                  {selectedGP.lineItems.map((li) => {
                    const ls = lineStates.find((s) => s.gatePassLineItemId === li.id);
                    if (!ls) return null;
                    const meters = parseInt(ls.metersReturned, 10);
                    const lineTotal = ls.checked && ls.metersReturned && !isNaN(meters) && meters > 0
                      ? Number(BigInt(li.ratePerMeterPaisa) * BigInt(meters)) / 100
                      : null;
                    const overLimit = ls.checked && !isNaN(meters) && meters > li.meters;

                    return (
                      <div
                        key={li.id}
                        className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-3 py-3 transition-colors ${ls.checked ? 'bg-blue-50/60' : 'bg-white'}`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={ls.checked}
                          onChange={() => toggleLine(li.id)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600"
                        />

                        {/* Variant info */}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{li.variant.code} – {li.variant.name}</p>
                          {lineTotal !== null && (
                            <p className="text-xs text-blue-600 font-medium">
                              Return value: PKR {lineTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>

                        {/* Dispatched meters */}
                        <span className="text-sm text-gray-500 text-right">{li.meters}m</span>

                        {/* Rate */}
                        <span className="text-sm text-gray-500 text-right whitespace-nowrap">{li.ratePerMeterDisplay}</span>

                        {/* Meters input */}
                        <div className="w-28">
                          <input
                            type="number"
                            min={1}
                            max={li.meters}
                            value={ls.metersReturned}
                            disabled={!ls.checked}
                            onChange={(e) => setMeters(li.id, e.target.value)}
                            placeholder={ls.checked ? `max ${li.meters}` : '—'}
                            className={`w-full rounded-lg border px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${overLimit ? 'border-red-400 bg-red-50' : ''}`}
                          />
                          {overLimit && (
                            <p className="mt-0.5 text-right text-xs text-red-500">max {li.meters}m</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live total */}
                {liveTotal !== null && liveTotal > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-orange-50 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-700">
                      Total Return ({lineStates.filter((ls) => ls.checked && ls.metersReturned && parseInt(ls.metersReturned) > 0).length} variant{lineStates.filter((ls) => ls.checked && ls.metersReturned && parseInt(ls.metersReturned) > 0).length !== 1 ? 's' : ''})
                    </span>
                    <span className="text-base font-bold text-orange-700">
                      PKR {liveTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
          </form>
        </div>

        {/* Footer (outside scroll) */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="return-form"
            disabled={!gatePassId || mutation.isPending}
            className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Processing…' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Return Detail Row ────────────────────────────────────────────────────────

function ReturnRow({ sr }: { sr: SalesReturn }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3 text-sm font-medium text-blue-700">{sr.returnNumber}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{sr.client.name}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{sr.gatePass.gatePassNumber}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(sr.date)}</td>
        <td className="px-4 py-3 text-sm font-medium text-red-600">{sr.totalAmountDisplay}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{sr.reason ?? '—'}</td>
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-6 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase text-gray-500">
                  <th className="pb-1 pr-4">Variant</th>
                  <th className="pb-1 pr-4">Orig. Meters</th>
                  <th className="pb-1 pr-4">Returned</th>
                  <th className="pb-1 pr-4">Rate/m</th>
                  <th className="pb-1">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sr.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="py-1 pr-4 font-medium">{li.variant.code} – {li.variant.name}</td>
                    <td className="py-1 pr-4 text-gray-500">{li.originalMeters}m</td>
                    <td className="py-1 pr-4 text-orange-600 font-medium">{li.metersReturned}m</td>
                    <td className="py-1 pr-4 text-gray-500">{li.ratePerMeterDisplay}</td>
                    <td className="py-1 text-red-600 font-medium">{li.lineAmountDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SalesReturnPage() {
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-returns', page, dateFrom, dateTo],
    queryFn: () => salesReturnApi.list({ page, limit: 20, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
  });

  const returns = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={22} className="text-orange-500" />
          <h1 className="text-xl font-bold text-gray-900">Sales Returns</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Return
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
            className="self-end rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-red-500">Failed to load sales returns.</p>
        ) : returns.length === 0 ? (
          <EmptyState message="No sales returns yet. Create a return when a customer sends back goods." />
        ) : (
          <table className="w-full text-left">
            <thead className="border-b bg-gray-50">
              <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Return #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Gate Pass</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((sr) => <ReturnRow key={sr.id} sr={sr} />)}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-gray-500">
              {(page - 1) * meta.limit + 1}–{Math.min(page * meta.limit, meta.total)} of {meta.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && <CreateReturnForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
