import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Calendar, Package } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDatePKT } from '../../utils/date';
import { formatPaisaToRupees } from '../../utils/currency';
import { useRole } from '../../hooks/useRole';
import { orderApi } from '../../services/order.api';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canViewFinance } = useRole();

  const { data: orderResp, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.getOrderById(id!),
    enabled: !!id,
  });

  const order = orderResp?.data;

  if (isLoading) return <LoadingSpinner />;

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-500">Order not found</p>
        <button
          onClick={() => navigate('/orders')}
          className="mt-4 min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const metersRemaining = order.metersOrdered - order.metersDelivered;
  const deadlineDate = new Date(order.deliveryDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / msPerDay,
  );

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
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
                {order.orderNumber}
              </h1>
              <StatusBadge status={order.status} />
              {order.isOverdue && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  <AlertTriangle size={12} />
                  Overdue
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Client:{' '}
              <button
                onClick={() =>
                  navigate(`/orders/client/${order.client.id}`)
                }
                className="font-medium text-blue-600 hover:underline"
              >
                {order.client.name}
              </button>
            </p>
            <p className="text-sm text-gray-500">
              Variant: {order.variant.code} — {order.variant.name}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Created: {formatDatePKT(order.createdAt)}</p>
          </div>
        </div>

        {/* Fulfillment progress bar */}
        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Fulfillment</span>
            <span className="font-bold text-gray-900">
              {order.fulfillmentPercent}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                order.fulfillmentPercent >= 100
                  ? 'bg-green-500'
                  : order.fulfillmentPercent >= 50
                    ? 'bg-blue-500'
                    : 'bg-orange-500'
              }`}
              style={{
                width: `${Math.min(order.fulfillmentPercent, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package size={14} />
            Ordered
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {order.metersOrdered.toLocaleString()}m
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package size={14} />
            Delivered
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {order.metersDelivered.toLocaleString()}m
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package size={14} />
            Remaining
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {metersRemaining.toLocaleString()}m
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={14} />
            Deadline
          </div>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {formatDatePKT(order.deliveryDeadline)}
          </p>
          <p
            className={`mt-0.5 text-xs font-medium ${
              daysRemaining < 0
                ? 'text-red-600'
                : daysRemaining <= 7
                  ? 'text-orange-600'
                  : 'text-gray-500'
            }`}
          >
            {daysRemaining < 0
              ? `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} overdue`
              : daysRemaining === 0
                ? 'Due today'
                : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
          </p>
        </div>
      </div>

      {/* Financial details (finance roles only) */}
      {canViewFinance() &&
        order.ratePerMeterPaisa !== undefined && (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Financial Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-gray-500">Rate per Meter</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {order.ratePerMeterDisplay ||
                    formatPaisaToRupees(order.ratePerMeterPaisa)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {order.totalAmountDisplay ||
                    formatPaisaToRupees(order.totalAmountPaisa ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Client Outstanding</p>
                <p className="mt-1 text-lg font-bold text-amber-700">
                  {order.clientOutstandingDisplay ||
                    formatPaisaToRupees(order.clientOutstandingPaisa ?? 0)}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Delivery history placeholder */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Delivery History
        </h2>
        <p className="text-sm text-gray-500">
          Linked gate pass deliveries will appear here as meters are delivered
          against this order.
        </p>
      </div>
    </div>
  );
}
