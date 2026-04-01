import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';

export interface WorkerOption {
  id: string;
  name: string;
}

interface WorkerMultiSelectProps {
  options: WorkerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function WorkerMultiSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search workers...',
  disabled = false,
  error,
  className = '',
}: WorkerMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedWorkers = options.filter((w) => value.includes(w.id));
  const filtered = useMemo(
    () =>
      options.filter(
        (w) =>
          !value.includes(w.id) &&
          w.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [options, value, search],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addWorker = (id: string) => {
    onChange([...value, id]);
    setSearch('');
  };

  const removeWorker = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div
        className={`flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border p-2 ${
          error ? 'border-red-400' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100' : 'bg-white'}`}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
      >
        {selectedWorkers.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
          >
            {w.name}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWorker(w.id);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <div className="relative flex-1">
            <Search size={14} className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={selectedWorkers.length === 0 ? placeholder : ''}
              className="w-full min-w-[80px] border-none bg-transparent py-0.5 pl-6 text-sm focus:outline-none"
            />
          </div>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg">
          {filtered.map((w) => (
            <li
              key={w.id}
              onClick={() => addWorker(w.id)}
              className="cursor-pointer px-3 py-2 text-sm text-gray-900 hover:bg-blue-50"
            >
              {w.name}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
