import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, ConfirmDialog } from '../../../components/ui';
import { CurrencyInput, DatePicker } from '../../../components/forms';
import {
  financeApi,
  type RecordPaymentPayload,
} from '../../../services/finance.api';
import { formatPaisaToRupees } from '../../../utils/currency';
import { toISODate } from '../../../utils/date';

type PaymentMode = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';

interface PaymentFormProps {
  clientId: string;
  clientName: string;
  currentOutstanding: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentForm({
  clientId,
  clientName,
  currentOutstanding,
  onClose,
  onSuccess,
}: PaymentFormProps) {
  const queryClient = useQueryClient();
  const [amountPaisa, setAmountPaisa] = useState(0);
  const [date, setDate] = useState(toISODate(new Date()));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [chequeNumber, setChequeNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: RecordPaymentPayload) =>
      financeApi.recordPayment(clientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-clients'] });
      queryClient.invalidateQueries({
        queryKey: ['client-ledger', clientId],
      });
      onSuccess();
    },
  });

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!amountPaisa || amountPaisa <= 0) {
      newErrors.amount = 'Amount is required';
    }
    if (!date) {
      newErrors.date = 'Date is required';
    }
    if (paymentMode === 'CHEQUE' && !chequeNumber.trim()) {
      newErrors.chequeNumber = 'Cheque number is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    setShowConfirm(true);
  }

  function handleConfirm() {
    mutation.mutate({
      amountPaisa,
      date,
      paymentMode,
      chequeNumber: paymentMode === 'CHEQUE' ? chequeNumber.trim() : undefined,
      notes: notes.trim() || undefined,
    });
  }

  const newOutstanding = currentOutstanding - amountPaisa;

  const paymentModes: { value: PaymentMode; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  ];

  return (
    <>
      <Modal open onClose={onClose} title="Record Payment" size="md">
        <div className="space-y-4">
          <CurrencyInput
            label="Amount"
            value={amountPaisa}
            onChange={setAmountPaisa}
            placeholder="e.g. 50000"
            error={errors.amount}
          />

          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            max={toISODate(new Date())}
            error={errors.date}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Payment Mode
            </label>
            <div className="flex flex-wrap gap-2">
              {paymentModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setPaymentMode(mode.value)}
                  className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMode === mode.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'CHEQUE' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cheque Number
              </label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number"
                className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  errors.chequeNumber
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {errors.chequeNumber && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.chequeNumber}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error)?.message ?? 'Failed to record payment'}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Confirm Payment"
        message={`Record payment of ${formatPaisaToRupees(amountPaisa)} for ${clientName}? New outstanding will be ${formatPaisaToRupees(newOutstanding)}.`}
        confirmLabel="Confirm Payment"
        variant="warning"
        isLoading={mutation.isPending}
      />
    </>
  );
}
