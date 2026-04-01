import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { settingsApi, type SystemSetting } from '../../services/settings.api';

// ─── Inline Setting Row ─────────────────────────────────────────────────────

interface SettingRowProps {
  setting: SystemSetting;
  onSaved: () => void;
}

function SettingRow({ setting, onSaved }: SettingRowProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(setting.value);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: () => settingsApi.updateSystemSetting(setting.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-system'] });
      setToast({ type: 'success', message: 'Saved!' });
      setTimeout(() => {
        setEditing(false);
        setToast(null);
        onSaved();
      }, 600);
    },
    onError: (err: Error) => {
      setToast({ type: 'error', message: err.message || 'Failed to save' });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    mutation.mutate();
  };

  const handleCancel = () => {
    setValue(setting.value);
    setEditing(false);
    setToast(null);
  };

  return (
    <div className="border-b px-4 py-4 last:border-b-0">
      {toast && (
        <div
          className={`mb-2 rounded-lg px-3 py-2 text-xs font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">{setting.key}</h3>
          {setting.description && (
            <p className="mt-0.5 text-xs text-gray-500">{setting.description}</p>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 sm:min-w-[300px]"
          >
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={mutation.isPending || !value.trim()}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="Save"
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border text-gray-500 hover:bg-gray-50"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <code className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800">
              {setting.value}
            </code>
            <button
              onClick={() => setEditing(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SystemSettings() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['settings-system'],
    queryFn: settingsApi.getSystemSettings,
  });

  const settings = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border hover:bg-gray-50"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
            System Settings
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Configure application-wide settings
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        {settings.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No system settings found
          </div>
        ) : (
          settings.map((s) => (
            <SettingRow key={s.key} setting={s} onSaved={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}
