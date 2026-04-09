import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/forms/SearchableSelect';
import { DatePicker } from '../../components/forms/DatePicker';
import { CurrencyInput } from '../../components/forms/CurrencyInput';
import { formatPaisaToRupees } from '../../utils/currency';
import { useRole } from '../../hooks/useRole';
import {
  orderApi,
  type CreateOrderPayload,
} from '../../services/order.api';

interface LineItemRow {
  key: number;
  variantId: string;
  metersOrdered: string;
  ratePerMeterPaisa: number;
}

let rowKeyCounter = 0;

interface OrderFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function OrderForm({ onClose, onSuccess }: OrderFormProps) {
  const queryClient = useQueryClient();
  const { canViewFinance } = useRole();

  // ── Form state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { key: ++rowKeyCounter, variantId: '', metersOrdered: '', ratePerMeterPaisa: 0 },
  ]);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Reference data ──────────────────────────────────────────────────────
  const { data: clientsResp } = useQuery({
    queryKey: ['order-clients'],
    queryFn: () => orderApi.getClients(),
  });

  const { data: variantsResp } = useQuery({
    queryKey: ['order-variants'],
    queryFn: () => orderApi.getVariants(),
  });

  const { data: clientOrdersResp } = useQuery({
    queryKey: ['order-client-orders', clientId],
    queryFn: () => orderApi.getOrdersByClient(clientId),
    enabled: !!clientId,
  });

  const clients = clientsResp?.data ?? [];
  const variants = variantsResp?.data ?? [];
  const clientOrders = clientOrdersResp?.data ?? [];

  // Client outstanding: take the last order's clientOutstandingPaisa
  const clientOutstanding = clientOrders[0]?.clientOutstandingPaisa ?? null;

  // Grand total across all line items
  const grandTotal = lineItems.reduce((sum, li) => {
    const meters = Number(li.metersOrdered) || 0;
    return sum + Math.round(meters * li.ratePerMeterPaisa);
  }, 0);

  // Tomorrow's date as min for deadline
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDeadline = tomorrow.toISOString().split('T')[0];

  // ── Line item helpers ────────────────────────────────────────────────────
  const addRow = () => {
    setLineItems((prev) => [
      ...prev,
      { key: ++rowKeyCounter, variantId: '', metersOrdered: '', ratePerMeterPaisa: 0 },
    ]);
  };

  const removeRow = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = <K extends keyof LineItemRow>(index: number, field: K, value: LineItemRow[K]) => {
    setLineItems((prev) => {
      const next = [...prev];
      const cur = next[index];
      if (cur) next[index] = { ...cur, [field]: value };
      return next;
    });
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = 'Client is required';
    if (!deliveryDeadline) errs.deliveryDeadline = 'Delivery deadline is required';

    const validRows = lineItems.filter((li) => li.variantId || Number(li.metersOrdered) > 0 || li.ratePerMeterPaisa > 0);
    if (validRows.length === 0 || !lineItems.some((li) => li.variantId && Number(li.metersOrdered) > 0 && li.ratePerMeterPaisa > 0)) {
      errs.lineItems = 'At least one complete line item (variant + meters + rate) is required';
    }

    lineItems.forEach((li, i) => {
      if (!li.variantId) errs[`li_${i}_variant`] = 'Select variant';
      if (!li.metersOrdered || Number(li.metersOrdered) <= 0) errs[`li_${i}_meters`] = 'Enter meters';
      if (!li.ratePerMeterPaisa || li.ratePerMeterPaisa <= 0) errs[`li_${i}_rate`] = 'Enter rate';
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [clientId, deliveryDeadline, lineItems]);

  // ── Mutation ────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      orderApi.createOrder(payload),
    onSuccess: (result) => {
      setToast({
        type: 'success',
        message: `Order ${result.data.orderNumber} created!`,
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['fulfillment-report'] });
      setTimeout(onSuccess, 800);
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } } & Error) => {
      setToast({
        type: 'error',
        message:
          err.response?.data?.error?.message || err.message || 'Failed to create order',
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      clientId,
      lineItems: lineItems
        .filter((li) => li.variantId && Number(li.metersOrdered) > 0 && li.ratePerMeterPaisa > 0)
        .map((li) => ({
          variantId: li.variantId,
          metersOrdered: Number(li.metersOrdered),
          ratePerMeterPaisa: li.ratePerMeterPaisa,
        })),
      deliveryDeadline,
    });
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Permission guard
  if (!canViewFinance()) {
    return (
      <Modal open onClose={onClose} title="New Order" size="lg">
        <p className="text-sm text-red-600">
          You do not have permission to create orders.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="New Order" size="lg">
      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SearchableSelect
            label="Client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Select client"
            error={errors.clientId}
          />
          <DatePicker
            label="Delivery Deadline"
            value={deliveryDeadline}
            onChange={setDeliveryDeadline}
            min={minDeadline}
            error={errors.deliveryDeadline}
          />
        </div>

        {/* Client outstanding balance */}
        {clientId && clientOutstanding && Number(clientOutstanding) > 0 && (
          <div className="rounded-lg bg-amber-50 px-4 py-3">
            <span className="text-sm text-amber-700">Client Outstanding: </span>
            <span className="text-sm font-bold text-amber-900">
              {formatPaisaToRupees(Number(clientOutstanding))}
            </span>
          </div>
        )}

        {/* Line Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Order Line Items</label>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} /> Add Variant
            </button>
          </div>
          {errors.lineItems && (
            <p className="mb-2 text-xs text-red-600">{errors.lineItems}</p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Variant</th>
                  <th className="px-3 py-2 text-right">Meters</th>
                  <th className="px-3 py-2 text-right">Rate / Meter</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((li, idx) => {
                  const lineTotal = Math.round((Number(li.metersOrdered) || 0) * li.ratePerMeterPaisa);
                  return (
                    <tr key={li.key}>
                      <td className="px-3 py-2 min-w-[180px]">
                        <SearchableSelect
                          options={variants.map((v) => ({ value: v.id, label: `${v.code} — ${v.name}` }))}
                          value={li.variantId}
                          onChange={(val) => updateRow(idx, 'variantId', val)}
                          placeholder="Select variant"
                          error={errors[`li_${idx}_variant`]}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="1"
                          value={li.metersOrdered}
                          onChange={(e) => updateRow(idx, 'metersOrdered', e.target.value)}
                          className={`w-24 rounded-lg border px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                            errors[`li_${idx}_meters`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                          placeholder="0"
                        />
                        {errors[`li_${idx}_meters`] && (
                          <p className="mt-0.5 text-xs text-red-600">{errors[`li_${idx}_meters`]}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <CurrencyInput
                          value={li.ratePerMeterPaisa}
                          onChange={(val) => updateRow(idx, 'ratePerMeterPaisa', val)}
                          placeholder="e.g. 50"
                          error={errors[`li_${idx}_rate`]}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        {lineTotal > 0 ? formatPaisaToRupees(lineTotal) : '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={lineItems.length <= 1}
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {grandTotal > 0 && (
                <tfoot className="border-t bg-green-50">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium text-gray-700">
                      Grand Total
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-green-900">
                      {formatPaisaToRupees(grandTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating…
              </>
            ) : (
              'Create Order'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
