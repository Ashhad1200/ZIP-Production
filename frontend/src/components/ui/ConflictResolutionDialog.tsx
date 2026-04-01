import { Modal } from './Modal';
import type { QueuedMutation } from '../../services/offlineQueue';
import { useState } from 'react';

interface ConflictResolutionDialogProps {
  open: boolean;
  conflicts: QueuedMutation[];
  onResolve: (id: string, action: 'use-server' | 'use-mine' | 'skip') => Promise<void>;
  onClose: () => void;
}

export function ConflictResolutionDialog({
  open,
  conflicts,
  onResolve,
  onClose,
}: ConflictResolutionDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);

  if (conflicts.length === 0) return null;

  const conflict = conflicts[Math.min(currentIndex, conflicts.length - 1)];
  if (!conflict) return null;

  const handleAction = async (action: 'use-server' | 'use-mine' | 'skip') => {
    setResolving(true);
    try {
      await onResolve(conflict.id, action);
      if (currentIndex >= conflicts.length - 1) {
        setCurrentIndex(0);
      }
    } finally {
      setResolving(false);
    }
  };

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Resolve Conflict" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Conflict on <span className="font-mono font-semibold">{conflict.method}</span>{' '}
          <span className="font-mono">{conflict.url}</span>
          {conflicts.length > 1 && (
            <span className="ml-2 text-gray-400">
              ({currentIndex + 1} of {conflicts.length})
            </span>
          )}
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Server version */}
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Server Version
            </h4>
            <pre className="max-h-60 overflow-auto rounded-lg bg-green-50 p-3 text-xs text-green-900">
              {formatJson(conflict.conflictData?.server)}
            </pre>
          </div>

          {/* Queued version */}
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Your Version
            </h4>
            <pre className="max-h-60 overflow-auto rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
              {formatJson(conflict.conflictData?.queued)}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            disabled={resolving}
            onClick={() => handleAction('skip')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            disabled={resolving}
            onClick={() => handleAction('use-server')}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Use Server Version
          </button>
          <button
            disabled={resolving}
            onClick={() => handleAction('use-mine')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use My Version
          </button>
        </div>
      </div>
    </Modal>
  );
}
