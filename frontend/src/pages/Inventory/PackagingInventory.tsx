import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Package, ArrowUp, ArrowDown, Edit2, ChevronUp, AlertTriangle, History,
} from 'lucide-react';
import { packagingApi, PackagingMaterial, PackagingAdjustment } from '../../services/inventory.api';
import { CurrencyInput } from '../../components/forms/CurrencyInput';
import { formatPaisaToRupees } from '../../utils/currency';

// ─── Add / Edit Material Modal ───────────────────────────────────────────────
function MaterialModal({
  material,
  onClose,
}: {
  material?: PackagingMaterial;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(material?.name ?? '');
  const [unit, setUnit] = useState(material?.unit ?? 'pcs');
  const [ratePerUnitPaisa, setRatePerUnitPaisa] = useState(material?.ratePerUnitPaisa ?? 0);
  const [threshold, setThreshold] = useState<string>(
    material?.lowStockThreshold != null ? String(material.lowStockThreshold) : '',
  );
  const [notes, setNotes] = useState(material?.notes ?? '');

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        unit,
        ratePerUnitPaisa,
        lowStockThreshold: threshold !== '' ? Number(threshold) : undefined,
        notes: notes || undefined,
      };
      if (material) return packagingApi.updateMaterial(material.id, payload);
      return packagingApi.createMaterial(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-materials'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">{material ? 'Edit Material' : 'Add Packaging Material'}</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Carton Box, BOPP Roll"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs, rolls, kg, boxes…"
            />
          </div>
          <CurrencyInput
            label="Rate per Unit"
            value={ratePerUnitPaisa}
            onChange={setRatePerUnitPaisa}
            placeholder="e.g. 450"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert (optional)</label>
            <input
              type="number"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Quantity below which to warn"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {saveMutation.isError && (
          <p className="text-red-600 text-sm">{(saveMutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!name || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Adjustment Modal ────────────────────────────────────────────────────────
function AdjustmentModal({
  material,
  onClose,
}: {
  material: PackagingMaterial;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [notes, setNotes] = useState('');

  const adjMutation = useMutation({
    mutationFn: () =>
      packagingApi.recordAdjustment(material.id, {
        quantity: direction === 'IN' ? Number(qty) : -Number(qty),
        type,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packaging-materials'] });
      qc.invalidateQueries({ queryKey: ['packaging-adjustments', material.id] });
      onClose();
    },
  });

  const inTypes = ['PURCHASE', 'ADJUSTMENT', 'RETURN'];
  const outTypes = ['CONSUMPTION', 'ADJUSTMENT', 'DAMAGE'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Stock Adjustment — {material.name}</h2>
        <p className="text-sm text-gray-500">
          Current stock: <strong>{material.currentStock} {material.unit}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Current rate: <strong>{formatPaisaToRupees(material.ratePerUnitPaisa)}/{material.unit}</strong>
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => { setDirection('IN'); setType('PURCHASE'); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${direction === 'IN' ? 'bg-green-600 text-white border-green-600' : 'hover:bg-gray-50'}`}
          >
            <ArrowUp className="inline w-4 h-4 mr-1" /> Add Stock
          </button>
          <button
            onClick={() => { setDirection('OUT'); setType('CONSUMPTION'); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${direction === 'OUT' ? 'bg-red-600 text-white border-red-600' : 'hover:bg-gray-50'}`}
          >
            <ArrowDown className="inline w-4 h-4 mr-1" /> Use Stock
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({material.unit}) *</label>
            <input
              type="number"
              min="1"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {(direction === 'IN' ? inTypes : outTypes).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {adjMutation.isError && (
          <p className="text-red-600 text-sm">{(adjMutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!qty || Number(qty) <= 0 || adjMutation.isPending}
            onClick={() => adjMutation.mutate()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {adjMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Panel ───────────────────────────────────────────────────────────
function HistoryPanel({ materialId }: { materialId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['packaging-adjustments', materialId],
    queryFn: () => packagingApi.listAdjustments(materialId),
  });

  const adjustments: PackagingAdjustment[] = data?.data ?? [];

  if (isLoading) return <p className="text-sm text-gray-400 py-2">Loading…</p>;
  if (adjustments.length === 0) return <p className="text-sm text-gray-400 py-2">No adjustments yet.</p>;

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      {adjustments.map((adj) => {
        const isIn = adj.quantity > 0;
        return (
          <div key={adj.id} className="flex items-center gap-3 text-sm">
            <span className={`flex-none w-16 text-right font-medium ${isIn ? 'text-green-600' : 'text-red-600'}`}>
              {isIn ? '+' : ''}{adj.quantity}
            </span>
            <span className="text-gray-500">{adj.type}</span>
            {adj.totalCostPaisa != null && (
              <span className="text-gray-500">{formatPaisaToRupees(adj.totalCostPaisa)}</span>
            )}
            {adj.notes && <span className="text-gray-400 truncate">{adj.notes}</span>}
            <span className="ml-auto text-gray-400 text-xs flex-none">
              {new Date(adj.createdAt).toLocaleDateString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Material Row ─────────────────────────────────────────────────────────────
function MaterialRow({
  material,
  onEdit,
  onAdjust,
}: {
  material: PackagingMaterial;
  onEdit: (m: PackagingMaterial) => void;
  onAdjust: (m: PackagingMaterial) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${material.isBelowThreshold ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="p-4 flex items-center gap-4">
        {/* Icon + Name */}
        <div className="flex-none w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Package className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{material.name}</span>
            {material.isBelowThreshold && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <AlertTriangle className="w-3 h-3" /> Low Stock
              </span>
            )}
          </div>
          <span className="text-sm text-gray-500">{material.unit}</span>
        </div>

        {/* Stock count */}
        <div className="text-right mr-2">
          <p className="text-2xl font-bold text-gray-900">{material.currentStock}</p>
          <p className="text-xs text-gray-400">{material.unit} in stock</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatPaisaToRupees(material.ratePerUnitPaisa)}/{material.unit}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdjust(material)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Adjust
          </button>
          <button
            onClick={() => onEdit(material)}
            className="p-1.5 text-gray-400 hover:text-gray-600 border rounded-lg"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 border rounded-lg"
            title="View history"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <HistoryPanel materialId={material.id} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PackagingInventory() {
  const [showAdd, setShowAdd] = useState(false);
  const [editMaterial, setEditMaterial] = useState<PackagingMaterial | undefined>();
  const [adjustMaterial, setAdjustMaterial] = useState<PackagingMaterial | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['packaging-materials'],
    queryFn: () => packagingApi.listMaterials(),
  });

  const materials: PackagingMaterial[] = data?.data ?? [];
  const lowStockCount = materials.filter((m) => m.isBelowThreshold).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packaging Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track cartons, rolls, and other packaging materials</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      {/* Low stock alert bar */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-none" />
          <span><strong>{lowStockCount}</strong> material{lowStockCount > 1 ? 's are' : ' is'} below the low-stock threshold.</span>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Materials', value: materials.length },
          { label: 'Low Stock', value: lowStockCount },
          { label: 'Total Items', value: materials.reduce((s, m) => s + m.currentStock, 0) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Material list */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-8">Loading…</p>
      ) : materials.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No packaging materials added yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 text-blue-600 hover:underline text-sm">
            Add your first material
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              onEdit={setEditMaterial}
              onAdjust={setAdjustMaterial}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && <MaterialModal onClose={() => setShowAdd(false)} />}
      {editMaterial && (
        <MaterialModal material={editMaterial} onClose={() => setEditMaterial(undefined)} />
      )}
      {adjustMaterial && (
        <AdjustmentModal material={adjustMaterial} onClose={() => setAdjustMaterial(undefined)} />
      )}
    </div>
  );
}
