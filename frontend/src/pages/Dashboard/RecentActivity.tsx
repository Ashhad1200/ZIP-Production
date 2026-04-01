import { useQuery } from '@tanstack/react-query';
import { Truck, Package, FileText, ShoppingCart } from 'lucide-react';
import { dashboardApi } from '../../services/dashboard.api';
import type { ActivityItem, RecentGatePass } from '../../services/dashboard.api';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDateTimePKT } from '../../utils/date';

const ACTIVITY_ICONS: Record<ActivityItem['type'], typeof Truck> = {
  GATE_PASS: Truck,
  PRODUCTION: Package,
  VOUCHER: FileText,
  ORDER: ShoppingCart,
};

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  GATE_PASS: 'bg-blue-100 text-blue-600',
  PRODUCTION: 'bg-indigo-100 text-indigo-600',
  VOUCHER: 'bg-amber-100 text-amber-600',
  ORDER: 'bg-green-100 text-green-600',
};

function GatePassCard({ gp }: { gp: RecentGatePass }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
        <Truck size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {gp.gatePassNumber}
          </span>
          <StatusBadge status={gp.status} />
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-600">
          {gp.client} — {gp.variants}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
          <span>{gp.totalMeters.toLocaleString()}m</span>
          <span>{formatDateTimePKT(gp.createdAt)}</span>
          <span>by {gp.createdBy}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  const Icon = ACTIVITY_ICONS[item.type] ?? Package;
  const colorClasses = ACTIVITY_COLORS[item.type] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`rounded-lg p-2 ${colorClasses}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{item.title}</p>
        <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
          <span>{formatDateTimePKT(item.timestamp)}</span>
          <span>by {item.actor}</span>
        </div>
      </div>
    </div>
  );
}

export function RecentActivity() {
  const { data: gpData, isLoading: gpLoading } = useQuery({
    queryKey: ['dashboard-recent-gate-passes'],
    queryFn: () => dashboardApi.getRecentGatePasses(10),
  });

  const { data: actData, isLoading: actLoading } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(20),
  });

  const gatePasses = gpData?.data ?? [];
  const activities = actData?.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Recent Gate Passes */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-semibold text-gray-900">Recent Gate Passes</h3>
        {gpLoading ? (
          <LoadingSpinner size="sm" />
        ) : gatePasses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No recent gate passes
          </p>
        ) : (
          <div className="space-y-3">
            {gatePasses.map((gp) => (
              <GatePassCard key={gp.id} gp={gp} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-semibold text-gray-900">Recent Activity</h3>
        {actLoading ? (
          <LoadingSpinner size="sm" />
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No recent activity
          </p>
        ) : (
          <div className="divide-y">
            {activities.map((item) => (
              <ActivityItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
