import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { formatDatePKT } from '../../utils/date';
import { POLLING_INTERVALS } from '../../utils/constants';
import {
  inventoryApi,
  type FinishedGoodsStockItem,
} from '../../services/inventory.api';

function stockBadge(row: FinishedGoodsStockItem) {
  if (row.isBelowThreshold) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        LOW STOCK
      </span>
    );
  }
  if (
    row.lowStockThreshold !== null &&
    row.currentMeters <= row.lowStockThreshold * 1.2
  ) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        WARNING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      OK
    </span>
  );
}

export function FinishedGoodsStock() {
  // ── Finished goods stock ─────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['finished-goods-stock'],
    queryFn: () => inventoryApi.getFinishedGoods(),
    refetchInterval: POLLING_INTERVALS.INVENTORY,
  });

  const items = data?.data ?? [];

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<FinishedGoodsStockItem>[] = [
    {
      key: 'variant',
      header: 'Variant',
      sortable: true,
      render: (row) => row.variant.name,
    },
    {
      key: 'code',
      header: 'Code',
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-xs text-gray-600">
          {row.variant.code}
        </span>
      ),
    },
    {
      key: 'currentMeters',
      header: 'Current Meters',
      sortable: true,
      render: (row) => row.currentMeters.toLocaleString(),
    },
    {
      key: 'cartons',
      header: 'Cartons',
      hideOnMobile: true,
      render: (row) => {
        const mpc = row.variant.metersPerCarton;
        if (!mpc || mpc <= 0) return <span className="text-gray-400">—</span>;
        return Math.ceil(row.currentMeters / mpc).toLocaleString();
      },
    },
    {
      key: 'threshold',
      header: 'Threshold',
      hideOnMobile: true,
      render: (row) =>
        row.lowStockThreshold !== null
          ? row.lowStockThreshold.toLocaleString()
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => stockBadge(row),
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      sortable: true,
      hideOnMobile: true,
      render: (row) => formatDatePKT(row.lastUpdated),
    },
  ];

  // ── Mobile card ──────────────────────────────────────────────────────────
  const mobileCard = (row: FinishedGoodsStockItem) => {
    const mpc = row.variant.metersPerCarton;
    const cartons = mpc && mpc > 0 ? Math.ceil(row.currentMeters / mpc) : null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            {row.variant.name}
          </span>
          {stockBadge(row)}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-xs text-gray-500">
            {row.variant.code}
          </span>
          <span className="font-medium">
            {row.currentMeters.toLocaleString()} m
            {cartons != null && (
              <span className="ml-1 text-xs text-gray-500">({cartons} ctn)</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Threshold:{' '}
            {row.lowStockThreshold !== null
              ? row.lowStockThreshold.toLocaleString()
              : '—'}
          </span>
          <span>{formatDatePKT(row.lastUpdated)}</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Finished Goods Stock
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Current inventory of finished products
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          mobileCard={mobileCard}
          emptyMessage="No finished goods stock data"
        />
      </div>
    </div>
  );
}
