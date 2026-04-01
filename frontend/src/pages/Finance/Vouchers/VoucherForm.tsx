import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../../../components/ui';
import {
  CurrencyInput,
  DatePicker,
  SearchableSelect,
} from '../../../components/forms';
import {
  financeApi,
  type CreateVoucherPayload,
} from '../../../services/finance.api';
import { toISODate } from '../../../utils/date';

interface VoucherFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const APPROVAL_THRESHOLD_PAISA = 20000000; // PKR 2,00,000

export function VoucherForm({ onClose, onSuccess }: VoucherFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [amountPaisa, setAmountPaisa] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CHEQUE'>('CASH');
  const [chequeNumber, setChequeNumber] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categoriesResp } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: financeApi.getExpenseCategories,
  });

  const { data: companiesResp } = useQuery({
    queryKey: ['companies'],
    queryFn: financeApi.getCompanies,
  });

  // Flatten categories: "Parent > Child" format
  const categoryOptions = (categoriesResp?.data ?? []).flatMap((parent) => {
    const opts = [{ value: parent.id, label: parent.name }];
    if (parent.children) {
      parent.children.forEach((child) => {
        opts.push({
          value: child.id,
          label: `${parent.name} › ${child.name}`,
        });
      });
    }
    return opts;
  });

  const companyOptions = (companiesResp?.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const mutation = useMutation({
    mutationFn: (payload: CreateVoucherPayload) =>
      financeApi.createVoucher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-vouchers'] });
      onSuccess();
    },
  });

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!date) newErrors.date = 'Date is required';
    if (!amountPaisa || amountPaisa <= 0)
      newErrors.amount = 'Amount is required';
    if (!categoryId) newErrors.categoryId = 'Category is required';
    if (!companyId) newErrors.companyId = 'Company is required';
    if (paymentMode === 'CHEQUE' && !chequeNumber.trim())
      newErrors.chequeNumber = 'Cheque number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      amountPaisa,
      categoryId,
      paymentMode,
      chequeNumber: paymentMode === 'CHEQUE' ? chequeNumber.trim() : undefined,
      companyId,
    });
  }

  const requiresApproval = amountPaisa >= APPROVAL_THRESHOLD_PAISA;

  return (
    <Modal open onClose={onClose} title="New Voucher" size="lg">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Voucher title"
            className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
              errors.title
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description..."
            rows={2}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            error={errors.date}
          />

          <div>
            <CurrencyInput
              label="Amount"
              value={amountPaisa}
              onChange={setAmountPaisa}
              placeholder="e.g. 5000"
              error={errors.amount}
            />
            {requiresApproval && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle size={12} />
                Requires owner approval
              </p>
            )}
          </div>
        </div>

        {/* Category */}
        <SearchableSelect
          label="Expense Category"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Select category"
          error={errors.categoryId}
        />

        {/* Payment Mode */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Payment Mode
          </label>
          <div className="flex gap-2">
            {(['CASH', 'CHEQUE'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  paymentMode === mode
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {mode === 'CASH' ? 'Cash' : 'Cheque'}
              </button>
            ))}
          </div>
        </div>

        {/* Cheque Number */}
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

        {/* Company */}
        <SearchableSelect
          label="Company"
          options={companyOptions}
          value={companyId}
          onChange={setCompanyId}
          placeholder="Select company"
          error={errors.companyId}
        />

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {(mutation.error as Error)?.message ?? 'Failed to create voucher'}
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
          {mutation.isPending ? 'Creating...' : 'Create Voucher'}
        </button>
      </div>
    </Modal>
  );
}
