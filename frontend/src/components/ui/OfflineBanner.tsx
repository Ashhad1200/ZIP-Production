import { WifiOff } from 'lucide-react';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useState } from 'react';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

export function OfflineBanner() {
  const { isOnline, queueCount, conflicts, resolveConflict, refreshState } =
    useOfflineQueue();
  const [showConflicts, setShowConflicts] = useState(false);

  const visible = !isOnline || queueCount > 0 || conflicts.length > 0;
  if (!visible) return null;

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm">
        <div className="flex items-center gap-2">
          <WifiOff size={16} />
          {!isOnline ? (
            <span>
              You&apos;re offline &mdash; {queueCount} operation(s) queued
            </span>
          ) : (
            <span>Syncing &mdash; {queueCount} operation(s) remaining</span>
          )}
        </div>

        {conflicts.length > 0 && (
          <button
            onClick={() => setShowConflicts(true)}
            className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Resolve {conflicts.length} conflict(s)
          </button>
        )}
      </div>

      {/* Push page content down when banner is visible */}
      <div className="h-10" />

      <ConflictResolutionDialog
        open={showConflicts}
        conflicts={conflicts}
        onResolve={async (id, action) => {
          await resolveConflict(id, action);
          const remaining = conflicts.filter((c) => c.id !== id);
          if (remaining.length === 0) setShowConflicts(false);
        }}
        onClose={() => {
          setShowConflicts(false);
          refreshState();
        }}
      />
    </>
  );
}
