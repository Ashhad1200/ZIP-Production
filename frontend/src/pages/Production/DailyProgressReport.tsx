import { useState } from 'react';
import { ChevronLeft, ChevronRight, Zap, Ruler, Trash2, AlertTriangle } from 'lucide-react';
import { addDays, subDays, parseISO } from 'date-fns';
import { DatePicker } from '../../components/forms/DatePicker';
import { KPICard } from '../../components/ui/KPICard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { useSmartQuery } from '../../hooks/useSmartQuery';
import { toISODate, formatDatePKT } from '../../utils/date';
import { POLLING_INTERVALS } from '../../utils/constants';
import {
  productionApi,
  type DPRData,
  type DPRPlantData,
  type DPRShiftData,
} from '../../services/production.api';

export function DailyProgressReport() {
  const [date, setDate] = useState(toISODate(new Date()));

  const { data: dprResp, isLoading } = useSmartQuery<{ data: DPRData }>({
    queryKey: ['daily-report', date],
    queryFn: () => productionApi.getDailyReport(date),
    pollingInterval: POLLING_INTERVALS.LISTS,
  });

  const report = dprResp?.data;

  const goToDay = (offset: number) => {
    const current = parseISO(date);
    const next = offset > 0 ? addDays(current, offset) : subDays(current, Math.abs(offset));
    setDate(toISODate(next));
  };

  // Compute grand totals from plant data
  const grandTotalElectricity = report?.plants.reduce((sum, p) => {
    return (
      sum +
      (p.dayShift?.electricityUnits ?? 0) +
      (p.nightShift?.electricityUnits ?? 0)
    );
  }, 0) ?? 0;

  const grandTotalScrap = report?.plants.reduce((sum, p) => {
    return (
      sum +
      (p.dayShift?.scrapGrams ?? 0) +
      (p.nightShift?.scrapGrams ?? 0)
    );
  }, 0) ?? 0;

  return (
    <div>
      {/* Header with date navigation */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          Daily Progress Report
        </h1>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToDay(-1)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50"
              aria-label="Previous day"
            >
              <ChevronLeft size={20} />
            </button>
            <DatePicker
              value={date}
              onChange={setDate}
              max={toISODate(new Date())}
              className="flex-1 sm:w-48"
            />
            <button
              onClick={() => goToDay(1)}
              disabled={date >= toISODate(new Date())}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
              aria-label="Next day"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <span className="text-sm text-gray-500">
            {formatDatePKT(date)}
          </span>
        </div>
      </div>

      {isLoading && <LoadingSpinner />}

      {!isLoading && !report && (
        <EmptyState message={`No production data for ${formatDatePKT(date)}`} />
      )}

      {report && (
        <>
          {/* Grand totals */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KPICard
              title="Total Meters"
              value={report.grandTotalMeters.toLocaleString()}
              icon={<Ruler size={20} />}
            />
            <KPICard
              title="Electricity Units"
              value={grandTotalElectricity.toLocaleString()}
              icon={<Zap size={20} />}
            />
            <KPICard
              title="Scrap (g)"
              value={grandTotalScrap.toLocaleString()}
              icon={<Trash2 size={20} />}
            />
            <KPICard
              title="Plants Reporting"
              value={report.plants.length}
              icon={<Ruler size={20} />}
            />
          </div>

          {/* Per-plant breakdown */}
          <div className="space-y-4">
            {report.plants.map((plant) => (
              <PlantCard key={plant.plant.id} plant={plant} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-component: Per-plant card ─────────────────────────────────────────

function PlantCard({ plant }: { plant: DPRPlantData }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {plant.plant.name}
        </h2>
        <span className="text-sm font-medium text-gray-600">
          {plant.totalMeters.toLocaleString()} m total
        </span>
      </div>

      <div className="divide-y">
        {plant.dayShift && (
          <ShiftSection label="☀️ Day Shift" data={plant.dayShift} />
        )}
        {plant.nightShift && (
          <ShiftSection label="🌙 Night Shift" data={plant.nightShift} />
        )}
        {!plant.dayShift && !plant.nightShift && (
          <div className="px-4 py-6 text-center text-sm text-gray-400 md:px-6">
            No shift data recorded
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftSection({ label, data }: { label: string; data: DPRShiftData }) {
  return (
    <div className="px-4 py-4 md:px-6">
      {/* Shift header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {data.hasDiscrepancy && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle size={12} />
            Discrepancy
          </span>
        )}
      </div>

      {/* Variant breakdown */}
      {data.variants.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-1 pr-4 font-medium">Variant</th>
                <th className="pb-1 pr-4 text-right font-medium">Meters</th>
              </tr>
            </thead>
            <tbody>
              {data.variants.map((v) => (
                <tr key={v.code} className="border-t border-gray-100">
                  <td className="py-1.5 pr-4 text-gray-900">
                    {v.code} – {v.name}
                  </td>
                  <td className="py-1.5 text-right font-medium text-gray-900">
                    {v.meters.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="py-1.5 pr-4 text-gray-700">Total</td>
                <td className="py-1.5 text-right text-gray-900">
                  {data.metersProduced.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <span className="block text-xs text-gray-500">Electricity</span>
          <span className="text-sm font-medium text-gray-900">
            {data.electricityUnits.toLocaleString()} units
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <span className="block text-xs text-gray-500">Scrap</span>
          <span className="text-sm font-medium text-gray-900">
            {data.scrapGrams.toLocaleString()} g
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <span className="block text-xs text-gray-500">Workers</span>
          <span className="text-sm font-medium text-gray-900">
            {data.workers.length}
            {data.workers.length > 0 && data.workers.length <= 5 && (
              <span className="ml-1 text-xs text-gray-400">
                ({data.workers.join(', ')})
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
