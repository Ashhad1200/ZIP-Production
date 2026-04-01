import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { formatDatePKT } from '../../utils/date';
import { POLLING_INTERVALS } from '../../utils/constants';
import {
  inventoryApi,
  type RawMaterialStockItem,
} from '../../services/inventory.api';

function stockBadge(row: RawMaterialStockItem) {
  if (row.isBelowThreshold) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        LOW STOCK
      </span>
    );
  }
  if (
    row.lowStockThresholdBags !== null &&
    row.currentBags <= row.lowStockThresholdBags * 1.2
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

export function RawMaterialStock() {
  // ── Raw material stock ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['raw-material-stock'],
    queryFn: inventoryApi.getRawMaterials,
    refetchInterval: POLLING_INTERVALS.INVENTORY,
  });

  const items = data?.data ?? [];

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: Column<RawMaterialStockItem>[] = [
    {
      key: 'grainType',
      header: 'Grain Type',
      sortable: true,
      render: (row) => row.grainType.name,
    },
    {
      key: 'currentBags',
      header: 'Current Bags',
      sortable: true,
      render: (row) => row.currentBags.toFixed(2),
    },
    {
      key: 'threshold',
      header: 'Threshold',
      hideOnMobile: true,
      render: (row) =>
        row.lowStockThresholdBags !== null
          ? row.lowStockThresholdBags.toLocaleString()
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
  const mobileCard = (row: RawMaterialStockItem) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {row.grainType.name}
        </span>
        {stockBadge(row)}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Current Stock</span>
        <span className="font-medium">{row.currentBags.toFixed(2)} bags</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Threshold:{' '}
          {row.lowStockThresholdBags !== null
            ? row.lowStockThresholdBags.toLocaleString()
            : '—'}
        </span>
        <span>{formatDatePKT(row.lastUpdated)}</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Raw Material Stock
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Current inventory of raw materials
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
          emptyMessage="No raw material stock data"
        />
      </div>
    </div>
  );
}
