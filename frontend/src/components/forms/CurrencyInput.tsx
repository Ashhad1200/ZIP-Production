import { useState, useCallback, type ChangeEvent } from 'react';
import { formatPaisaToRupees, parseDisplayToPaisa } from '../../utils/currency';

interface CurrencyInputProps {
  value: number; // paisa
  onChange: (paisa: number) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function CurrencyInput({
  value,
  onChange,
  label,
  placeholder = 'e.g. 2,00,000 or 2L',
  disabled = false,
  error,
  className = '',
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() =>
    value ? formatPaisaToRupees(value).replace(/^Rs\s/, '') : '',
  );
  const [focused, setFocused] = useState(false);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplay(raw);
      const paisa = parseDisplayToPaisa(raw);
      onChange(paisa);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setFocused(false);
    if (value) {
      setDisplay(formatPaisaToRupees(value).replace(/^Rs\s/, ''));
    }
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          Rs
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
            error ? 'border-red-400' : 'border-gray-300'
          } ${focused ? '' : ''} disabled:bg-gray-100`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
