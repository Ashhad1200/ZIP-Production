import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  grandTotalDebit: number;
  grandTotalCredit: number;
  isBalanced: boolean;
}

function fmtPaisa(p: number): string {
  if (p === 0) return '—';
  const rupees = Math.abs(p) / 100;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees);
}

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
};
const TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-50 text-blue-800',
  LIABILITY: 'bg-orange-50 text-orange-800',
  EQUITY: 'bg-purple-50 text-purple-800',
  REVENUE: 'bg-green-50 text-green-800',
  EXPENSE: 'bg-red-50 text-red-800',
};

export function TrialBalancePage() {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] ?? '';

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(lastDay);

  const { data: tbData, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      const res = await api.get(`/accounting/trial-balance?${params}`);
      return res.data.data as TrialBalanceData;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  // Group rows by account type
  const grouped = tbData ? TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    rows: tbData.rows.filter((r) => r.accountType === type),
    totalDebit: tbData.rows.filter((r) => r.accountType === type).reduce((s, r) => s + r.debitBalance, 0),
    totalCredit: tbData.rows.filter((r) => r.accountType === type).reduce((s, r) => s + r.creditBalance, 0),
  })).filter((g) => g.rows.length > 0) : [];

  return (
    <div>
      <div className="flex items-center gap-3">
        <Scale size={28} className="text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Trial Balance</h1>
          <p className="text-sm text-gray-500">Verify that total debits equal total credits</p>
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
        <button onClick={() => refetch()} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Generate
        </button>
      </div>

      {/* Balance indicator */}
      {tbData && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 ${tbData.isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {tbData.isBalanced ? (
            <>
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="text-sm font-medium text-green-800">Books are balanced — Total Debits equal Total Credits</span>
            </>
          ) : (
            <>
              <AlertTriangle size={20} className="text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Imbalance detected — Difference: PKR {fmtPaisa(Math.abs(tbData.grandTotalDebit - tbData.grandTotalCredit))}
              </span>
            </>
          )}
        </div>
      )}

      {/* Trial Balance Table */}
      {isLoading ? (
        <div className="mt-8 text-center text-gray-400">Loading trial balance...</div>
      ) : !tbData?.rows.length ? (
        <div className="mt-8 text-center text-gray-400">No transactions found for this period</div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Account Name</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Debit (PKR)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Credit (PKR)</th>
                <th className="px-4 py-3 text-right font-medium text-green-700 bg-green-50">Debit Balance</th>
                <th className="px-4 py-3 text-right font-medium text-red-700 bg-red-50">Credit Balance</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <>
                  {/* Group header */}
                  <tr key={`hdr-${group.type}`}>
                    <td colSpan={6} className={`px-4 py-2 font-semibold text-sm ${TYPE_COLORS[group.type]}`}>
                      {group.label}
                    </td>
                  </tr>
                  {/* Account rows */}
                  {group.rows.map((row) => (
                    <tr key={row.accountCode} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-500">{row.accountCode}</td>
                      <td className="px-4 py-2 text-gray-800">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtPaisa(row.totalDebit)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtPaisa(row.totalCredit)}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-700 bg-green-50/30">{fmtPaisa(row.debitBalance)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700 bg-red-50/30">{fmtPaisa(row.creditBalance)}</td>
                    </tr>
                  ))}
                  {/* Group subtotal */}
                  <tr key={`sub-${group.type}`} className="border-t bg-gray-50">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right text-xs font-semibold text-gray-500">{group.label} Subtotal</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-green-800 bg-green-50/30">{fmtPaisa(group.totalDebit)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-red-800 bg-red-50/30">{fmtPaisa(group.totalCredit)}</td>
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Grand Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-mono text-green-800 bg-green-100">
                  PKR {fmtPaisa(tbData.grandTotalDebit)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-red-800 bg-red-100">
                  PKR {fmtPaisa(tbData.grandTotalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
