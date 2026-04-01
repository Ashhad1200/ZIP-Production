import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column, StatusBadge } from '../../../components/ui';
import {
  DatePicker,
  SearchableSelect,
} from '../../../components/forms';
import { useSmartQuery } from '../../../hooks/useSmartQuery';
import {
  financeApi,
  type Voucher,
} from '../../../services/finance.api';
import { formatPaisaToRupees } from '../../../utils/currency';
import { formatDatePKT } from '../../../utils/date';
import { POLLING_INTERVALS, PAGINATION_DEFAULTS } from '../../../utils/constants';
import { VoucherForm } from './VoucherForm';

export function VoucherList() {
  const [page, setPage] = useState<number>(PAGINATION_DEFAULTS.PAGE);
  const [categoryId, setCategoryId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: categoriesResp } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: financeApi.getExpenseCategories,
  });

  const { data: companiesResp } = useQuery({
    queryKey: ['companies'],
    queryFn: financeApi.getCompanies,
  });

  const { data, isLoading } = useSmartQuery({
    queryKey: [
      'finance-vouchers',
      page,
      categoryId,
      companyId,
      approvalStatus,
      dateFrom,
      dateTo,
      paymentMode,
    ],
    queryFn: () =>
      financeApi.getVouchers({
        page,
        limit: PAGINATION_DEFAULTS.LIMIT,
        categoryId: categoryId || undefined,
        companyId: companyId || undefined,
        approvalStatus: approvalStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        paymentMode: paymentMode || undefined,
      }),
    pollingInterval: POLLING_INTERVALS.FINANCE,
  });

  const vouchers = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  // Flatten categories for filter
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categoriesResp?.data ?? []).flatMap((parent) => {
      const opts = [{ value: parent.id, label: parent.name }];
      if (parent.children) {
        parent.children.forEach((child) =>
          opts.push({
            value: child.id,
            label: `${parent.name} › ${child.name}`,
          }),
        );
      }
      return opts;
    }),
  ];

  const companyOptions = [
    { value: '', label: 'All Companies' },
    ...(companiesResp?.data ?? []).map((c) => ({
      value: c.id,
      label: c.name,
    })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'AUTO_APPROVED', label: 'Auto Approved' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  const paymentModeOptions = [
    { value: '', label: 'All Modes' },
    { value: 'CASH', label: 'Cash' },
    { value: 'CHEQUE', label: 'Cheque' },
  ];

  const columns: Column<Voucher>[] = [
    {
      key: 'voucherNumber',
      header: 'Voucher #',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {row.voucherNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => row.title,
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDatePKT(row.date),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-medium">
          {formatPaisaToRupees(row.amountPaisa)}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      render: (row) => row.category.name,
    },
    {
      key: 'paymentMode',
      header: 'Mode',
      hideOnMobile: true,
      render: (row) => row.paymentMode,
    },
    {
      key: 'company',
      header: 'Company',
      hideOnMobile: true,
      render: (row) => row.company.name,
    },
    {
      key: 'approvalStatus',
      header: 'Status',
      render: (row) => <StatusBadge status={row.approvalStatus} />,
    },
  ];

  const mobileCard = (row: Voucher) => (
    <div className="space-y-2 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          {row.voucherNumber}
        </span>
        <StatusBadge status={row.approvalStatus} />
      </div>
      <p className="font-semibold text-gray-900">{row.title}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {formatPaisaToRupees(row.amountPaisa)}
        </span>
        <span className="text-gray-500">{formatDatePKT(row.date)}</span>
      </div>
      <div className="flex gap-2 text-xs text-gray-500">
        <span>{row.category.name}</span>
        <span>•</span>
        <span>{row.paymentMode}</span>
        <span>•</span>
        <span>{row.company.name}</span>
      </div>
    </div>
  );

  function resetFilters() {
    setPage(PAGINATION_DEFAULTS.PAGE);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            Vouchers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Expense vouchers and approval workflow
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New Voucher
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SearchableSelect
          label="Category"
          options={categoryOptions}
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            resetFilters();
          }}
          placeholder="All Categories"
          clearable
        />
        <SearchableSelect
          label="Company"
          options={companyOptions}
          value={companyId}
          onChange={(v) => {
            setCompanyId(v);
            resetFilters();
          }}
          placeholder="All Companies"
          clearable
        />
        <SearchableSelect
          label="Status"
          options={statusOptions}
          value={approvalStatus}
          onChange={(v) => {
            setApprovalStatus(v);
            resetFilters();
          }}
          placeholder="All Statuses"
          clearable
        />
        <SearchableSelect
          label="Payment Mode"
          options={paymentModeOptions}
          value={paymentMode}
          onChange={(v) => {
            setPaymentMode(v);
            resetFilters();
          }}
          placeholder="All Modes"
          clearable
        />
        <DatePicker
          label="From"
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v);
            resetFilters();
          }}
        />
        <DatePicker
          label="To"
          value={dateTo}
          onChange={(v) => {
            setDateTo(v);
            resetFilters();
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={vouchers}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        keyExtractor={(row) => row.id}
        mobileCard={mobileCard}
        emptyMessage="No vouchers found"
      />

      {showForm && (
        <VoucherForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
