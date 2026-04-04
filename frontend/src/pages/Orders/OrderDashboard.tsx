import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { KPICard } from '../../components/ui/KPICard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { formatDatePKT } from '../../utils/date';
import { PAGINATION_DEFAULTS } from '../../utils/constants';
import { useRole } from '../../hooks/useRole';
import {
  orderApi,
  type Order,
  type OrderFilters,
} from '../../services/order.api';
import { OrderForm } from './OrderForm';

export function OrderDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canViewFinance } = useRole();

  // ── Filter state ────────────────────────────────────────────────────────
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [variantFilter, setVariantFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => orderApi.approveOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-report'] });
      showToast('success', 'Order approved and sent to production');
    },
    onError: () => showToast('error', 'Failed to approve order'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => orderApi.rejectOrder(id, 'Rejected by finance'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-report'] });
      showToast('success', 'Order rejected');
    },
    onError: () => showToast('error', 'Failed to reject order'),
  });

  // ── Fulfillment report for KPIs ─────────────────────────────────────────
  const { data: reportResp } = useQuery({
    queryKey: ['fulfillment-report'],
    queryFn: () => orderApi.getFulfillmentReport(),
  });
  const summary = reportResp?.data?.summary;

  // ── Reference data ──────────────────────────────────────────────────────
  const { data: clientsResp } = useQuery({
    queryKey: ['order-clients'],
    queryFn: () => orderApi.getClients(),
  });
  const { data: variantsResp } = useQuery({
    queryKey: ['order-variants'],
    queryFn: () => orderApi.getVariants(),
  });

  const clients = clientsResp?.data ?? [];
  const variants = variantsResp?.data ?? [];

  // ── Orders query ────────────────────────────────────────────────────────
  const filters: OrderFilters = {
    page,
    limit: PAGINATION_DEFAULTS.LIMIT,
    clientId: clientFilter || undefined,
    status: statusFilter || undefined,
    variantId: variantFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    overdue: overdueOnly || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => orderApi.getOrders(filters),
  });

  const orders = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // ── Table columns ───────────────────────────────────────────────────────
  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-blue-600">{row.orderNumber}</span>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (row) => row.client.name,
    },
    {
      key: 'variant',
      header: 'Variant',
      sortable: true,
      hideOnMobile: true,
      render: (row) => `${row.variant.code} — ${row.variant.name}`,
    },
    {
      key: 'metersOrdered',
      header: 'Ordered',
      sortable: true,
      hideOnMobile: true,
      render: (row) => `${row.metersOrdered.toLocaleString()}m`,
    },
    {
      key: 'metersDelivered',
      header: 'Delivered',
      sortable: true,
      hideOnMobile: true,
      render: (row) => `${row.metersDelivered.toLocaleString()}m`,
    },
    {
      key: 'fulfillmentPercent',
      header: 'Fulfillment',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${
                row.fulfillmentPercent >= 100
                  ? 'bg-green-500'
                  : row.fulfillmentPercent >= 50
                    ? 'bg-blue-500'
                    : 'bg-orange-500'
              }`}
              style={{ width: `${Math.min(row.fulfillmentPercent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">
            {row.fulfillmentPercent}%
          </span>
        </div>
      ),
    },
    {
      key: 'deliveryDeadline',
      header: 'Deadline',
      sortable: true,
      hideOnMobile: true,
      render: (row) => formatDatePKT(row.deliveryDeadline),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.isOverdue && (
            <AlertTriangle size={14} className="text-red-500" />
          )}
        </div>
      ),
    },
    ...(canViewFinance() ? [{
      key: 'actions' as keyof Order,
      header: '',
      render: (row: Order) => row.status === 'PENDING_APPROVAL' ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => approveMutation.mutate(row.id)}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            title="Approve"
            className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <ShieldCheck size={13} /> Approve
          </button>
          <button
            onClick={() => rejectMutation.mutate(row.id)}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            title="Reject"
            className="flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <ShieldX size={13} /> Reject
          </button>
        </div>
      ) : null,
    }] : []),
  ];

  // ── Mobile card ─────────────────────────────────────────────────────────
  const mobileCard = (row: Order) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-600">
          {row.orderNumber}
        </span>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.isOverdue && (
            <AlertTriangle size={14} className="text-red-500" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-900">{row.client.name}</span>
        <span className="text-gray-500">
          {row.variant.code}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {row.metersDelivered.toLocaleString()}/{row.metersOrdered.toLocaleString()}m
          ({row.fulfillmentPercent}%)
        </span>
        <span>Due: {formatDatePKT(row.deliveryDeadline)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${
            row.fulfillmentPercent >= 100
              ? 'bg-green-500'
              : row.fulfillmentPercent >= 50
                ? 'bg-blue-500'
                : 'bg-orange-500'
          }`}
          style={{ width: `${Math.min(row.fulfillmentPercent, 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Orders
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage client orders and track fulfillment
          </p>
        </div>
        {canViewFinance() && (
          <button
            onClick={() => setShowForm(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            New Order
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          title="Total Orders"
          value={summary?.totalOrders ?? '—'}
          icon={<Package size={20} />}
        />
        <KPICard
          title="Pending"
          value={summary?.pending ?? '—'}
          icon={<Clock size={20} />}
        />
        <KPICard
          title="Ongoing"
          value={summary?.ongoing ?? '—'}
          icon={<PlayCircle size={20} />}
        />
        <KPICard
          title="Completed"
          value={summary?.completed ?? '—'}
          icon={<CheckCircle2 size={20} />}
          className={
            summary?.overdue
              ? 'ring-1 ring-red-200'
              : ''
          }
        />
      </div>

      {/* Overdue badge */}
      {summary?.overdue ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5">
          <AlertTriangle size={16} className="text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {summary.overdue} overdue order{summary.overdue !== 1 ? 's' : ''}
          </span>
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <SearchableSelect
          options={[
            { value: '', label: 'All Clients' },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={clientFilter}
          onChange={(v) => {
            setClientFilter(v);
            setPage(1);
          }}
          placeholder="All Clients"
          clearable
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'PENDING_APPROVAL', label: 'Awaiting Approval' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'ONGOING', label: 'Ongoing' },
            { value: 'COMPLETED', label: 'Completed' },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          placeholder="All Statuses"
          clearable
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Variants' },
            ...variants.map((v) => ({
              value: v.id,
              label: `${v.code} — ${v.name}`,
            })),
          ]}
          value={variantFilter}
          onChange={(v) => {
            setVariantFilter(v);
            setPage(1);
          }}
          placeholder="All Variants"
          clearable
        />
        <DatePicker
          label="From"
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            setPage(1);
          }}
        />
        <DatePicker
          label="To"
          value={dateTo}
          onChange={(v) => {
            setDateTo(v);
            setPage(1);
          }}
        />
      </div>

      {/* Overdue checkbox */}
      <div className="mb-4">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show overdue only</span>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No orders found"
        />
      </div>

      {/* Create form modal */}
      {showForm && (
        <OrderForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({
              queryKey: ['fulfillment-report'],
            });
          }}
        />
      )}
    </div>
  );
}
