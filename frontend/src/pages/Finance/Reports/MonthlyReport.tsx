import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { KPICard } from '../../../components/ui';
import { SearchableSelect } from '../../../components/forms';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { financeApi } from '../../../services/finance.api';
import { formatPaisaToRupees } from '../../../utils/currency';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - i;
  return { value: String(y), label: String(y) };
});

export function MonthlyReport() {
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [companyId, setCompanyId] = useState('');

  const { data: companiesResp } = useQuery({
    queryKey: ['companies'],
    queryFn: financeApi.getCompanies,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['monthly-report', year, month, companyId],
    queryFn: () =>
      financeApi.getMonthlyReport(
        Number(year),
        Number(month),
        companyId || undefined,
      ),
    enabled: !!year && !!month,
  });

  const report = data?.data;

  const companyOptions = [
    { value: '', label: 'All Companies' },
    ...(companiesResp?.data ?? []).map((c) => ({
      value: c.id,
      label: c.name,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Monthly Report
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Financial overview with category breakdown
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SearchableSelect
          label="Month"
          options={MONTHS}
          value={month}
          onChange={setMonth}
          placeholder="Select month"
        />
        <SearchableSelect
          label="Year"
          options={YEARS}
          value={year}
          onChange={setYear}
          placeholder="Select year"
        />
        <SearchableSelect
          label="Company"
          options={companyOptions}
          value={companyId}
          onChange={setCompanyId}
          placeholder="All Companies"
          clearable
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : isError || !report ? (
        <EmptyState message="No report data available for the selected period" />
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Opening Balance"
              value={formatPaisaToRupees(report.openingBalancePaisa)}
              icon={<Minus className="text-gray-500" size={20} />}
            />
            <KPICard
              title="Total Inflow"
              value={formatPaisaToRupees(report.inflowPaisa)}
              icon={<ArrowDown className="text-green-600" size={20} />}
              className="border-green-200 bg-green-50"
            />
            <KPICard
              title="Total Outflow"
              value={formatPaisaToRupees(report.outflowPaisa)}
              icon={<ArrowUp className="text-red-600" size={20} />}
              className="border-red-200 bg-red-50"
            />
            <KPICard
              title="Closing Balance"
              value={formatPaisaToRupees(report.closingBalancePaisa)}
              icon={<BarChart3 className="text-blue-600" size={20} />}
              className="border-blue-200 bg-blue-50"
            />
          </div>

          {/* Inflow Breakdown */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Inflow Breakdown
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-sm text-gray-500">Client Payments</p>
                <p className="text-lg font-bold text-green-700">
                  {formatPaisaToRupees(report.inflowBreakdown.clientPayments)}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-sm text-gray-500">Scrap Sales</p>
                <p className="text-lg font-bold text-green-700">
                  {formatPaisaToRupees(report.inflowBreakdown.scrapSales)}
                </p>
              </div>
            </div>
          </div>

          {/* Category-wise Expense Breakdown */}
          <div className="rounded-lg border bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Outflow by Category
            </h2>
            {report.outflowByCategory.length === 0 ? (
              <p className="text-sm text-gray-500">
                No expense data for this period
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {report.outflowByCategory.map((cat) => (
                      <tr key={cat.category}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          {cat.category}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatPaisaToRupees(cat.amountPaisa)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                          {report.outflowPaisa > 0
                            ? (
                                (cat.amountPaisa / report.outflowPaisa) *
                                100
                              ).toFixed(1)
                            : '0.0'}
                          %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">
                        {formatPaisaToRupees(report.outflowPaisa)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-500">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
