import { type ChangeEvent } from 'react';
import { formatDatePKT, toISODate } from '../../utils/date';

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (isoDate: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  min?: string;
  max?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  error,
  min,
  max,
  className = '',
}: DatePickerProps) {
  const displayValue = value ? formatDatePKT(value) : (placeholder ?? '');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value; // YYYY-MM-DD from native picker
    if (dateVal) {
      onChange(toISODate(new Date(dateVal)));
    } else {
      onChange('');
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Display formatted value */}
        <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm text-gray-900">
          {displayValue}
        </div>
        <input
          type="date"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          min={min}
          max={max}
          className={`w-full rounded-lg border py-2 px-3 text-sm text-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
            error ? 'border-red-400' : 'border-gray-300'
          } disabled:bg-gray-100`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
