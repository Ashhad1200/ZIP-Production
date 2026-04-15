import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import api from '../../../services/api';

interface GLTransaction {
  id: string;
  date: string;
  entryNumber: string;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  clientName: string | null;
  debitPaisa: number;
  creditPaisa: number;
}

interface GLAccount {
  account: { id: string; code: string; name: string; accountType: string };
  openingBalance: number;
  transactions: GLTransaction[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isGroup: boolean;
}

function fmtPaisa(p: number): string {
  const rupees = Math.abs(p) / 100;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees);
}

function fmtBalance(p: number): string {
  const formatted = fmtPaisa(p);
  if (p < 0) return `(${formatted}) Cr`;
  if (p > 0) return `${formatted} Dr`;
  return '0.00';
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-orange-100 text-orange-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-red-100 text-red-800',
};

export function GeneralLedgerPage() {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] ?? '';

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDay);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: accounts } = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      const res = await api.get('/accounting/accounts');
      return res.data.data as Account[];
    },
  });

  const { data: glData, isLoading, refetch } = useQuery({
    queryKey: ['general-ledger', dateFrom, dateTo, selectedAccount],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (selectedAccount) params.set('accountId', selectedAccount);
      const res = await api.get(`/accounting/general-ledger?${params}`);
      return res.data.data as GLAccount[];
    },
    enabled: !!dateFrom && !!dateTo,
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const leafAccounts = (accounts || []).filter((a) => !a.isGroup);

  return (
    <div>
      <div className="flex items-center gap-3">
        <BookOpen size={28} className="text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">General Ledger</h1>
          <p className="text-sm text-gray-500">Account-wise transaction history with running balance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded border px-3 py-2 text-sm" />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
            <option value="">All Accounts</option>
            {leafAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
        <button onClick={() => refetch()} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Load
        </button>
      </div>

      {/* GL Accounts */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading general ledger...</div>
        ) : !glData?.length ? (
          <div className="text-center py-12 text-gray-400">No transactions found for this period</div>
        ) : (
          glData.map((gl) => {
            const isOpen = expanded.has(gl.account.id);
            return (
              <div key={gl.account.id} className="rounded-lg border bg-white overflow-hidden">
                <button
                  onClick={() => toggle(gl.account.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <span className="font-mono text-sm text-gray-500">{gl.account.code}</span>
                  <span className="font-semibold text-gray-900 flex-1">{gl.account.name}</span>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[gl.account.accountType] || 'bg-gray-100'}`}>
                    {gl.account.accountType}
                  </span>
                  <div className="text-right ml-4 min-w-[160px]">
                    <div className="text-xs text-gray-500">Closing Balance</div>
                    <div className={`font-mono text-sm font-semibold ${gl.closingBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {fmtBalance(gl.closingBalance)}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t">
                    {/* Summary bar */}
                    <div className="flex gap-6 px-4 py-2 bg-gray-50 text-xs">
                      <span className="text-gray-500">Opening: <span className="font-mono font-medium text-gray-700">{fmtBalance(gl.openingBalance)}</span></span>
                      <span className="text-gray-500">Total Debit: <span className="font-mono font-medium text-green-700">PKR {fmtPaisa(gl.totalDebit)}</span></span>
                      <span className="text-gray-500">Total Credit: <span className="font-mono font-medium text-red-700">PKR {fmtPaisa(gl.totalCredit)}</span></span>
                      <span className="text-gray-500">Closing: <span className={`font-mono font-medium ${gl.closingBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtBalance(gl.closingBalance)}</span></span>
                    </div>

                    {/* Transactions */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500">
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-left font-medium">Entry #</th>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-left font-medium">Source</th>
                          <th className="px-4 py-2 text-left font-medium">Client</th>
                          <th className="px-4 py-2 text-right font-medium">Debit (PKR)</th>
                          <th className="px-4 py-2 text-right font-medium">Credit (PKR)</th>
                          <th className="px-4 py-2 text-right font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {/* Opening balance row */}
                        {gl.openingBalance !== 0 && (
                          <tr className="bg-blue-50/50">
                            <td className="px-4 py-1.5 text-gray-400">—</td>
                            <td className="px-4 py-1.5 text-gray-400">—</td>
                            <td className="px-4 py-1.5 font-medium text-gray-600" colSpan={3}>Opening Balance</td>
                            <td className="px-4 py-1.5 text-right font-mono">{gl.openingBalance > 0 ? fmtPaisa(gl.openingBalance) : ''}</td>
                            <td className="px-4 py-1.5 text-right font-mono">{gl.openingBalance < 0 ? fmtPaisa(gl.openingBalance) : ''}</td>
                            <td className="px-4 py-1.5 text-right font-mono font-medium">{fmtBalance(gl.openingBalance)}</td>
                          </tr>
                        )}
                        {gl.transactions.length === 0 ? (
                          <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-400">No transactions in this period</td></tr>
                        ) : (
                          (() => {
                            let running = gl.openingBalance;
                            return gl.transactions.map((tx) => {
                              running += tx.debitPaisa - tx.creditPaisa;
                              return (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-1.5 text-gray-600">{new Date(tx.date).toLocaleDateString('en-PK')}</td>
                                  <td className="px-4 py-1.5 font-mono text-gray-500">{tx.entryNumber}</td>
                                  <td className="px-4 py-1.5 text-gray-700">{tx.description || '—'}</td>
                                  <td className="px-4 py-1.5">
                                    {tx.referenceType ? (
                                      <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs">{tx.referenceType}</span>
                                    ) : '—'}
                                  </td>
                                  <td className="px-4 py-1.5 text-gray-600">{tx.clientName || '—'}</td>
                                  <td className="px-4 py-1.5 text-right font-mono text-green-700">
                                    {tx.debitPaisa > 0 ? fmtPaisa(tx.debitPaisa) : ''}
                                  </td>
                                  <td className="px-4 py-1.5 text-right font-mono text-red-700">
                                    {tx.creditPaisa > 0 ? fmtPaisa(tx.creditPaisa) : ''}
                                  </td>
                                  <td className={`px-4 py-1.5 text-right font-mono font-medium ${running >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                    {fmtBalance(running)}
                                  </td>
                                </tr>
                              );
                            });
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
