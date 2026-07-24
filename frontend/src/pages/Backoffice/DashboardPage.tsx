import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import platformApi from '../../services/platform.api';
import { KPICard, LoadingSpinner } from '../../components/ui';
import { formatPaisaToRupees } from '../../utils/currency';

interface OrgRef {
  id: string;
  organization: { id: string; name: string };
  plan: { id: string; name: string; pricePaisa: string };
}

interface DashboardSummary {
  counts: { overdue: number; dueSoon: number; activeTrials: number; pendingPayments: number };
  overdue: OrgRef[];
  dueSoon: OrgRef[];
  activeTrials: OrgRef[];
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['platform', 'dashboard-summary'],
    queryFn: async () => (await platformApi.get<{ data: DashboardSummary }>('/dashboard/summary')).data.data,
  });

  if (isLoading || !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard title="Overdue Subscriptions" value={data.counts.overdue} />
        <KPICard title="Due Within 7 Days" value={data.counts.dueSoon} />
        <KPICard title="Active Trials" value={data.counts.activeTrials} />
        <Link to="/backoffice/payments">
          <KPICard title="Pending Payments" value={data.counts.pendingPayments} />
        </Link>
      </div>

      <Section title="Overdue" rows={data.overdue} emptyText="No overdue subscriptions" />
      <Section title="Due Soon (next 7 days)" rows={data.dueSoon} emptyText="Nothing due soon" />
      <Section title="Active Trials" rows={data.activeTrials} emptyText="No organizations currently on trial" />
    </div>
  );
}

function Section({ title, rows, emptyText }: { title: string; rows: OrgRef[]; emptyText: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-gray-900">{row.organization.name}</span>
              <span className="text-gray-500">
                {row.plan.name} &middot; {formatPaisaToRupees(Number(row.plan.pricePaisa))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
