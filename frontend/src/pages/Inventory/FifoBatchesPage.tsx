import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi, type FifoBatch, type GrainTypeRef } from '../../services/inventory.api';
import { formatPaisaToRupees } from '../../utils/currency';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';

function GrainTypeSection({ grainType, batches }: { grainType: GrainTypeRef; batches: FifoBatch[] }) {
  const [open, setOpen] = useState(true);
  const activeBatches = batches.filter(b => !b.isExhausted);
  const exhaustedBatches = batches.filter(b => b.isExhausted);
  const totalRemaining = batches.reduce((s, b) => s + b.bagsRemaining, 0);

  return (
    <div className="border border-gray-200 rounded-lg mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Package size={18} className="text-indigo-600" />
          <span className="font-semibold text-gray-800">{grainType.name}</span>
          <span className="text-xs text-gray-500 bg-gray-200 rounded px-2 py-0.5">{grainType.code}</span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">{totalRemaining}</span> bags remaining &middot;
          <span className="ml-2 text-green-700 font-medium">{activeBatches.length}</span> active batch{activeBatches.length !== 1 ? 'es' : ''} &middot;
          <span className="ml-2 text-gray-400">{exhaustedBatches.length}</span> exhausted
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-indigo-50 text-left text-xs text-indigo-700 uppercase tracking-wide">
                <th className="px-4 py-2">Purchase Date</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Total Bags</th>
                <th className="px-4 py-2 text-right">Consumed</th>
                <th className="px-4 py-2 text-right">Remaining</th>
                <th className="px-4 py-2 text-right">Rate / Bag</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr
                  key={batch.id}
                  className={`border-t ${batch.isExhausted ? 'bg-gray-50 text-gray-400' : 'hover:bg-indigo-50/30'}`}
                >
                  <td className="px-4 py-2">{batch.purchaseDate}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      batch.source === 'CONTAINER'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {batch.source === 'CONTAINER' ? 'Container' : 'Spot Market'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{batch.bagsTotal}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{batch.bagsConsumed}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {batch.bagsRemaining}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPaisaToRupees(batch.pricePerBagPaisa)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {batch.isExhausted ? (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Exhausted</span>
                    ) : batch.bagsRemaining === batch.bagsTotal ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Full</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Partial</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FifoBatchesPage() {
  const [includeExhausted, setIncludeExhausted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['fifo-batches', includeExhausted],
    queryFn: () => inventoryApi.getBatches({ includeExhausted }),
  });

  const batches = data?.data ?? [];

  // Group by grain type
  const grouped = batches.reduce<Record<string, { grainType: GrainTypeRef; batches: FifoBatch[] }>>((acc, b) => {
    const key = b.grainType.id;
    if (!acc[key]) acc[key] = { grainType: b.grainType, batches: [] };
    acc[key].batches.push(b);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FIFO Batch Stock</h1>
          <p className="text-sm text-gray-500 mt-1">Raw material batches tracked in purchase order for accurate costing</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeExhausted}
            onChange={e => setIncludeExhausted(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Show exhausted batches
        </label>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading batches…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Failed to load batches.
        </div>
      )}

      {!isLoading && !error && Object.keys(grouped).length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No batches found. Batches are created automatically when purchases are recorded.
        </div>
      )}

      {Object.values(grouped).map(({ grainType, batches: grainBatches }) => (
        <GrainTypeSection key={grainType.id} grainType={grainType} batches={grainBatches} />
      ))}
    </div>
  );
}
