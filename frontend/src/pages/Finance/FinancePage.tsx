import { useNavigate } from 'react-router-dom';
import { Users, FileText, BarChart3, TrendingUp, BookOpen, Scale, List } from 'lucide-react';

export default function FinancePage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Client Ledger',
      description: 'Client balances, payments, and outstanding amounts',
      icon: Users,
      path: '/finance/client-ledger',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Vouchers',
      description: 'Expense vouchers and approval workflow',
      icon: FileText,
      path: '/finance/vouchers',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Journal Entries',
      description: 'View all posted journal entries and their line details',
      icon: List,
      path: '/finance/journal-entries',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'General Ledger',
      description: 'Account-wise transactions with running balance',
      icon: BookOpen,
      path: '/finance/general-ledger',
      color: 'bg-cyan-50 text-cyan-600',
    },
    {
      title: 'Trial Balance',
      description: 'Verify debits equal credits across all accounts',
      icon: Scale,
      path: '/finance/trial-balance',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Monthly Reports',
      description: 'Financial reports with category breakdown',
      icon: BarChart3,
      path: '/finance/reports',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Profit & Loss',
      description: 'Monthly P&L: revenue, COGS, overheads, and net profit',
      icon: TrendingUp,
      path: '/finance/profit-loss',
      color: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Finance</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage client ledgers, expenses, and financial reports
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <button
            key={s.path}
            onClick={() => navigate(s.path)}
            className="flex items-start gap-4 rounded-lg border bg-white p-6 text-left hover:border-blue-300 hover:shadow-sm min-h-[44px]"
          >
            <div className={`rounded-lg p-3 ${s.color}`}>
              <s.icon size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{s.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
