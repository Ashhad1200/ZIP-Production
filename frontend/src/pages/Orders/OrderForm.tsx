import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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

interface OrderFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function OrderForm({ onClose, onSuccess }: OrderFormProps) {
  const queryClient = useQueryClient();
  const { canViewFinance } = useRole();

  // ── Form state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [metersOrdered, setMetersOrdered] = useState('');
  const [ratePerMeterPaisa, setRatePerMeterPaisa] = useState(0);
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

  // Fetch client outstanding when client is selected
  const { data: clientOrdersResp } = useQuery({
    queryKey: ['order-client-orders', clientId],
    queryFn: () => orderApi.getOrdersByClient(clientId),
    enabled: !!clientId,
  });

  const clients = clientsResp?.data ?? [];
  const variants = variantsResp?.data ?? [];
  const clientOrders = clientOrdersResp?.data ?? [];

  // Calculate client outstanding from existing orders
  const clientOutstanding = clientOrders.reduce(
    (sum, o) => sum + (o.clientOutstandingPaisa ?? 0),
    0,
  );

  // Auto-calculated total
  const totalAmountPaisa =
    metersOrdered && ratePerMeterPaisa
      ? Math.round(Number(metersOrdered) * ratePerMeterPaisa)
      : 0;

  // Tomorrow's date as min for deadline
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDeadline = tomorrow.toISOString().split('T')[0];

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = 'Client is required';
    if (!variantId) errs.variantId = 'Variant is required';
    if (!metersOrdered || Number(metersOrdered) <= 0)
      errs.metersOrdered = 'Enter valid meters';
    if (!ratePerMeterPaisa || ratePerMeterPaisa <= 0)
      errs.ratePerMeterPaisa = 'Enter valid rate';
    if (!deliveryDeadline) errs.deliveryDeadline = 'Delivery deadline is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [clientId, variantId, metersOrdered, ratePerMeterPaisa, deliveryDeadline]);

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
      variantId,
      metersOrdered: Number(metersOrdered),
      ratePerMeterPaisa,
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
      <Modal open onClose={onClose} title="New Order" size="md">
        <p className="text-sm text-red-600">
          You do not have permission to create orders.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="New Order" size="md">
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
        <SearchableSelect
          label="Client"
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
          value={clientId}
          onChange={setClientId}
          placeholder="Select client"
          error={errors.clientId}
        />

        {/* Client outstanding balance */}
        {clientId && clientOutstanding > 0 && (
          <div className="rounded-lg bg-amber-50 px-4 py-3">
            <span className="text-sm text-amber-700">Client Outstanding: </span>
            <span className="text-sm font-bold text-amber-900">
              {formatPaisaToRupees(clientOutstanding)}
            </span>
          </div>
        )}

        <SearchableSelect
          label="Variant"
          options={variants.map((v) => ({
            value: v.id,
            label: `${v.code} — ${v.name}`,
          }))}
          value={variantId}
          onChange={setVariantId}
          placeholder="Select variant"
          error={errors.variantId}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Meters Ordered
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={metersOrdered}
            onChange={(e) => setMetersOrdered(e.target.value)}
            placeholder="0"
            min="1"
            step="any"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
              errors.metersOrdered ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.metersOrdered && (
            <p className="mt-1 text-xs text-red-600">{errors.metersOrdered}</p>
          )}
        </div>

        <CurrencyInput
          label="Rate per Meter"
          value={ratePerMeterPaisa}
          onChange={setRatePerMeterPaisa}
          placeholder="e.g. 50"
          error={errors.ratePerMeterPaisa}
        />

        {/* Auto-calculated total */}
        {totalAmountPaisa > 0 && (
          <div className="rounded-lg bg-green-50 px-4 py-3">
            <span className="text-sm text-green-700">Total Amount: </span>
            <span className="text-sm font-bold text-green-900">
              {formatPaisaToRupees(totalAmountPaisa)}
            </span>
          </div>
        )}

        <DatePicker
          label="Delivery Deadline"
          value={deliveryDeadline}
          onChange={setDeliveryDeadline}
          min={minDeadline}
          error={errors.deliveryDeadline}
        />

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
