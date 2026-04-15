import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../../services/api';

interface JournalEntryLine {
  id: string;
  description: string | null;
  debitAmountPaisa: number;
  creditAmountPaisa: number;
  account: { id: string; code: string; name: string; accountType: string };
  client: { id: string; name: string } | null;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string | null;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  postedAt: string | null;
  createdAt: string;
  lines: JournalEntryLine[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  POSTED: 'bg-green-100 text-green-800',
  REVERSED: 'bg-red-100 text-red-800',
};

const REF_LABELS: Record<string, string> = {
  gate_pass: 'Gate Pass',
  payment: 'Payment',
  voucher: 'Voucher',
  scrap_sale: 'Scrap Sale',
  raw_material_purchase: 'RM Purchase',
  sales_return: 'Sales Return',
  payroll: 'Payroll',
};

function fmtPaisa(p: number): string {
  const rupees = Math.abs(p) / 100;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees);
}

export function JournalEntriesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [referenceType, setReferenceType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', page, status, referenceType, search, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (status) params.set('status', status);
      if (referenceType) params.set('referenceType', referenceType);
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/accounting/journal-entries?${params}`);
      return res.data as { data: JournalEntry[]; total: number; totalPages: number };
    },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Journal Entries</h1>
      <p className="mt-1 text-sm text-gray-500">View all posted journal entries across the system</p>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Entry # or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
              className="w-full rounded border px-9 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="REVERSED">Reversed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
          <select value={referenceType} onChange={(e) => { setReferenceType(e.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm">
            <option value="">All Sources</option>
            <option value="gate_pass">Gate Pass</option>
            <option value="payment">Payment</option>
            <option value="voucher">Voucher</option>
            <option value="scrap_sale">Scrap Sale</option>
            <option value="raw_material_purchase">RM Purchase</option>
            <option value="sales_return">Sales Return</option>
            <option value="payroll">Payroll</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm" />
        </div>
        <button
          onClick={() => { setSearch(searchInput); setPage(1); }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Summary */}
      {data && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {data.data.length} of {data.total} entries
        </p>
      )}

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Entry #</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Description</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Source</th>
              <th className="px-3 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-3 py-3 text-right font-medium text-gray-600">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.data.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No journal entries found</td></tr>
            ) : (
              data.data.map((entry) => {
                const isOpen = expanded.has(entry.id);
                const totalDebit = entry.lines.reduce((s, l) => s + l.debitAmountPaisa, 0);
                return (
                  <tr key={entry.id} className="group">
                    <td colSpan={7} className="p-0">
                      <button
                        onClick={() => toggle(entry.id)}
                        className="flex w-full items-center text-left hover:bg-gray-50 px-3 py-3"
                      >
                        <span className="w-8 flex-shrink-0">
                          {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        </span>
                        <span className="w-[130px] flex-shrink-0 font-mono text-xs">{entry.entryNumber}</span>
                        <span className="w-[100px] flex-shrink-0 text-gray-600">
                          {new Date(entry.entryDate).toLocaleDateString('en-PK')}
                        </span>
                        <span className="flex-1 truncate text-gray-700">{entry.description || '—'}</span>
                        <span className="w-[110px] flex-shrink-0 px-2">
                          {entry.referenceType ? (
                            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {REF_LABELS[entry.referenceType] || entry.referenceType}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="w-[90px] flex-shrink-0 px-2">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] || 'bg-gray-100'}`}>
                            {entry.status}
                          </span>
                        </span>
                        <span className="w-[120px] flex-shrink-0 text-right font-mono">
                          {fmtPaisa(totalDebit)}
                        </span>
                      </button>

                      {/* Expanded line details */}
                      {isOpen && (
                        <div className="border-t bg-gray-50 px-6 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="pb-2 text-left font-medium">Account</th>
                                <th className="pb-2 text-left font-medium">Description</th>
                                <th className="pb-2 text-left font-medium">Client</th>
                                <th className="pb-2 text-right font-medium">Debit (PKR)</th>
                                <th className="pb-2 text-right font-medium">Credit (PKR)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {entry.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="py-1.5">
                                    <span className="font-mono text-gray-500">{line.account.code}</span>
                                    <span className="ml-2 text-gray-700">{line.account.name}</span>
                                  </td>
                                  <td className="py-1.5 text-gray-600">{line.description || '—'}</td>
                                  <td className="py-1.5 text-gray-600">{line.client?.name || '—'}</td>
                                  <td className="py-1.5 text-right font-mono text-green-700">
                                    {line.debitAmountPaisa > 0 ? fmtPaisa(line.debitAmountPaisa) : ''}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-red-700">
                                    {line.creditAmountPaisa > 0 ? fmtPaisa(line.creditAmountPaisa) : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
