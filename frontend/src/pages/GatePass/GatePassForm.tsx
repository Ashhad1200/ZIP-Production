import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { gatePassApi, type Shift, type ClientRateResult, type StockResult } from '../../services/gate-pass.api';
import { SearchableSelect, DatePicker } from '../../components/forms';
import { ConfirmDialog, LoadingSpinner } from '../../components/ui';

interface LineItemRow {
  key: number;
  variantId: string;
  meters: number;
  rate: ClientRateResult | null;
  stock: StockResult | null;
  loadingRate: boolean;
  loadingStock: boolean;
}

let lineKeyCounter = 0;

export function GatePassForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [shift, setShift] = useState<Shift>('DAY');
  const [orderId, setOrderId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { key: ++lineKeyCounter, variantId: '', meters: 0, rate: null, stock: null, loadingRate: false, loadingStock: false },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lookups
  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['gatepass-clients'],
    queryFn: () => gatePassApi.getClients(),
  });

  const { data: variantsData, isLoading: loadingVariants } = useQuery({
    queryKey: ['gatepass-variants'],
    queryFn: () => gatePassApi.getVariants(),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['gatepass-client-orders', clientId],
    queryFn: () => gatePassApi.getClientOrders(clientId),
    enabled: !!clientId,
  });

  const clients = clientsData?.data ?? [];
  const variants = variantsData?.data ?? [];
  const orders = ordersData?.data ?? [];

  // Mutation
  const createMutation = useMutation({
    mutationFn: gatePassApi.create,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      setToast({ type: 'success', message: `Gate pass ${result.data.gatePassNumber} created successfully` });
      setTimeout(() => navigate('/gate-pass'), 1500);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setToast({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to create gate pass',
      });
    },
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Reset order when client changes
  useEffect(() => {
    setOrderId('');
  }, [clientId]);

  // Fetch rate and stock when line item variant changes
  const fetchRateAndStock = useCallback(
    async (index: number, variantId: string) => {
      if (!variantId) return;

      setLineItems((prev) => {
        const next = [...prev];
        const cur = next[index];
        if (cur) next[index] = { ...cur, loadingRate: !!clientId, loadingStock: true };
        return next;
      });

      // Fetch stock
      try {
        const stockResult = await gatePassApi.getStock(variantId);
        setLineItems((prev) => {
          const next = [...prev];
          const cur = next[index];
          if (cur) next[index] = { ...cur, stock: stockResult.data, loadingStock: false };
          return next;
        });
      } catch {
        setLineItems((prev) => {
          const next = [...prev];
          const cur = next[index];
          if (cur) next[index] = { ...cur, stock: null, loadingStock: false };
          return next;
        });
      }

      // Fetch rate only if client is selected
      if (clientId) {
        try {
          const rateResult = await gatePassApi.getClientRate(clientId, variantId);
          setLineItems((prev) => {
            const next = [...prev];
            const cur = next[index];
            if (cur) next[index] = { ...cur, rate: rateResult.data, loadingRate: false };
            return next;
          });
        } catch {
          setLineItems((prev) => {
            const next = [...prev];
            const cur = next[index];
            if (cur) next[index] = { ...cur, rate: null, loadingRate: false };
            return next;
          });
        }
      }
    },
    [clientId],
  );

  // Refetch all rates when client changes
  useEffect(() => {
    lineItems.forEach((item, idx) => {
      if (item.variantId && clientId) {
        fetchRateAndStock(idx, item.variantId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const updateLineItem = (index: number, field: keyof LineItemRow, value: string | number) => {
    setLineItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (cur) next[index] = { ...cur, [field]: value };
      return next;
    });

    if (field === 'variantId') {
      fetchRateAndStock(index, value as string);
    }
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { key: ++lineKeyCounter, variantId: '', meters: 0, rate: null, stock: null, loadingRate: false, loadingStock: false },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateLineTotal = (item: LineItemRow): string => {
    if (!item.rate || !item.meters) return '—';
    const ratePaisa = BigInt(item.rate.ratePerMeterPaisa);
    const total = ratePaisa * BigInt(item.meters);
    const rupees = Number(total) / 100;
    return `PKR ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateGrandTotal = (): string => {
    let totalPaisa = 0n;
    for (const item of lineItems) {
      if (item.rate && item.meters > 0) {
        totalPaisa += BigInt(item.rate.ratePerMeterPaisa) * BigInt(item.meters);
      }
    }
    const rupees = Number(totalPaisa) / 100;
    return `PKR ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = 'Client is required';
    if (!date) errs.date = 'Date is required';

    const validLines = lineItems.filter((li) => li.variantId && li.meters > 0);
    if (validLines.length === 0) {
      errs.lineItems = 'At least one line item with variant and meters is required';
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i]!;
      if (item.variantId && item.meters > 0) {
        if (item.stock && item.meters > item.stock.availableMeters) {
          errs[`line_${i}_stock`] = `Insufficient stock (available: ${item.stock.availableMeters}m)`;
        }
        if (!item.rate) {
          errs[`line_${i}_rate`] = 'No active rate found for this client-variant pair';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = () => {
    setShowConfirm(false);
    const validLines = lineItems
      .filter((li) => li.variantId && li.meters > 0)
      .map((li) => ({ variantId: li.variantId, meters: li.meters }));

    createMutation.mutate({
      clientId,
      date,
      shift,
      orderId: orderId || undefined,
      lineItems: validLines,
    });
  };

  if (loadingClients || loadingVariants) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New Gate Pass</h1>
        <button
          onClick={() => navigate('/gate-pass')}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg p-4 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {/* Client & Date row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchableSelect
            label="Client *"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Select client..."
            error={errors.clientId}
          />
          <DatePicker
            label="Date *"
            value={date}
            onChange={setDate}
            error={errors.date}
          />
        </div>

        {/* Shift & Order row */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift *</label>
            <div className="flex gap-3">
              {(['DAY', 'NIGHT'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    shift === s
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {s === 'DAY' ? '☀️ Day' : '🌙 Night'}
                </button>
              ))}
            </div>
          </div>

          {clientId && (
            <SearchableSelect
              label="Linked Order (optional)"
              options={orders.map((o) => ({
                value: o.id,
                label: `${o.orderNumber} — ${o.variant.code} (${o.metersDelivered}/${o.metersOrdered}m)`,
              }))}
              value={orderId}
              onChange={setOrderId}
              placeholder="Select order..."
              clearable
            />
          )}
        </div>

        {/* Line Items */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Add Row
            </button>
          </div>
          {errors.lineItems && (
            <p className="mt-1 text-xs text-red-600">{errors.lineItems}</p>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2 text-right">Meters</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Rate/m</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                  <th className="px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((item, idx) => (
                  <tr key={item.key}>
                    <td className="px-3 py-2 min-w-[200px]">
                      <SearchableSelect
                        options={variants.map((v) => ({ value: v.id, label: `${v.code} — ${v.name}` }))}
                        value={item.variantId}
                        onChange={(val) => updateLineItem(idx, 'variantId', val)}
                        placeholder="Select variant..."
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={item.meters || ''}
                        onChange={(e) => updateLineItem(idx, 'meters', parseInt(e.target.value) || 0)}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.loadingStock ? (
                        <span className="text-gray-400 text-xs">...</span>
                      ) : item.stock ? (
                        <span className="flex items-center justify-end gap-1">
                          {item.meters > 0 && item.meters > item.stock.availableMeters ? (
                            <AlertCircle size={14} className="text-red-500" />
                          ) : item.meters > 0 ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : null}
                          <span
                            className={
                              item.meters > 0 && item.meters > item.stock.availableMeters
                                ? 'text-red-600 font-medium'
                                : 'text-gray-600'
                            }
                          >
                            {item.stock.availableMeters}m
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {errors[`line_${idx}_stock`] && (
                        <p className="text-xs text-red-600 mt-0.5">{errors[`line_${idx}_stock`]}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {item.loadingRate ? (
                        <span className="text-gray-400 text-xs">...</span>
                      ) : item.rate ? (
                        <span className="text-gray-700">{item.rate.ratePerMeterDisplay}</span>
                      ) : item.variantId && clientId ? (
                        <span className="text-red-500 text-xs">No rate</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {errors[`line_${idx}_rate`] && (
                        <p className="text-xs text-red-600 mt-0.5">{errors[`line_${idx}_rate`]}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {calculateLineTotal(item)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Total */}
          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="text-right">
              <span className="text-sm text-gray-600">Grand Total:</span>
              <span className="ml-3 text-xl font-bold text-gray-900">{calculateGrandTotal()}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Gate Pass'}
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSubmit}
        title="Confirm Gate Pass"
        message={`Create gate pass for ${clients.find((c) => c.id === clientId)?.name ?? 'selected client'} with ${lineItems.filter((li) => li.variantId && li.meters > 0).length} item(s) totaling ${calculateGrandTotal()}? This will deduct stock and create a journal entry.`}
        confirmLabel="Create"
        variant="warning"
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
