import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDatePKT } from '../../utils/date';
import { orderApi, type Order } from '../../services/order.api';

export function ClientOrderHistory() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: ordersResp, isLoading } = useQuery({
    queryKey: ['orders-by-client', clientId],
    queryFn: () => orderApi.getOrdersByClient(clientId!),
    enabled: !!clientId,
  });

  const orders = ordersResp?.data ?? [];
  const clientName = orders.length > 0 ? orders[0]!.client.name : 'Client';

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
      key: 'variant',
      header: 'Variant',
      sortable: true,
      render: (row) => row.lineItems.map((li) => `${li.variant.code} — ${li.variant.name}`).join(', '),
    },
    {
      key: 'metersOrdered',
      header: 'Ordered',
      sortable: true,
      render: (row) => `${row.metersOrdered.toLocaleString()}m`,
    },
    {
      key: 'metersDelivered',
      header: 'Delivered',
      sortable: true,
      render: (row) => `${row.metersDelivered.toLocaleString()}m`,
    },
    {
      key: 'fulfillmentPercent',
      header: '%',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-12 overflow-hidden rounded-full bg-gray-200">
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
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'deliveryDeadline',
      header: 'Deadline',
      sortable: true,
      hideOnMobile: true,
      render: (row) => formatDatePKT(row.deliveryDeadline),
    },
  ];

  // ── Mobile card ─────────────────────────────────────────────────────────
  const mobileCard = (row: Order) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-600">
          {row.orderNumber}
        </span>
        <StatusBadge status={row.status} />
      </div>
      <div className="text-sm text-gray-700">
        {row.lineItems.map((li) => li.variant.code).join(', ')}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {row.metersDelivered.toLocaleString()}/{row.metersOrdered.toLocaleString()}m
          ({row.fulfillmentPercent}%)
        </span>
        <span>Due: {formatDatePKT(row.deliveryDeadline)}</span>
      </div>
    </div>
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/orders')}
        className="flex min-h-[44px] items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </button>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          {clientName} — Order History
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No orders found for this client"
        />
      </div>
    </div>
  );
}
