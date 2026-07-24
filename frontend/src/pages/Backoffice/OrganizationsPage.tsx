import { useQuery } from '@tanstack/react-query';
import platformApi from '../../services/platform.api';
import { DataTable, StatusBadge, type Column } from '../../components/ui';
import { formatPaisaToRupees } from '../../utils/currency';

interface OrganizationRow {
  id: string;
  name: string;
  contactEmail: string;
  status: string;
  trialEndsAt: string;
  createdAt: string;
  subscriptions: { plan: { name: string; pricePaisa: string } }[];
  _count: { companies: number; users: number };
}

export function OrganizationsPage() {
  const { data, isLoading } = useQuery<OrganizationRow[]>({
    queryKey: ['platform', 'organizations'],
    queryFn: async () => (await platformApi.get<{ data: OrganizationRow[] }>('/organizations')).data.data,
  });

  const columns: Column<OrganizationRow>[] = [
    { key: 'name', header: 'Organization', sortable: true },
    { key: 'contactEmail', header: 'Contact', hideOnMobile: true },
    {
      key: 'plan',
      header: 'Plan',
      render: (row) =>
        row.subscriptions[0]
          ? `${row.subscriptions[0].plan.name} (${formatPaisaToRupees(Number(row.subscriptions[0].plan.pricePaisa))})`
          : '—',
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'subCompanies', header: 'Sub-Companies', hideOnMobile: true, render: (row) => row._count.companies },
    { key: 'users', header: 'Users', hideOnMobile: true, render: (row) => row._count.users },
  ];

  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b px-4 py-3">
        <h1 className="font-semibold text-gray-900">Organizations</h1>
        <p className="text-sm text-gray-500">Every company registered on the platform</p>
      </div>
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyMessage="No organizations have signed up yet"
      />
    </div>
  );
}
