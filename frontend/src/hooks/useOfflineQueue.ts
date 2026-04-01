import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { mutationQueue, type QueuedMutation } from '../services/offlineQueue';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [conflicts, setConflicts] = useState<QueuedMutation[]>([]);
  const replayingRef = useRef(false);

  const refreshState = useCallback(async () => {
    try {
      const count = await mutationQueue.getCount();
      setQueueCount(count);
      const all = await mutationQueue.getAll();
      setConflicts(all.filter((m) => m.status === 'conflict'));
    } catch {
      // DB not ready yet — ignore
    }
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Poll queue state periodically and on mount
  useEffect(() => {
    refreshState();
    const id = setInterval(refreshState, 3000);
    return () => clearInterval(id);
  }, [refreshState]);

  const replayQueue = useCallback(async () => {
    if (replayingRef.current || !navigator.onLine) return;
    replayingRef.current = true;

    try {
      let next = await mutationQueue.peek();

      while (next) {
        try {
          await api.request({
            method: next.method,
            url: next.url,
            data: next.data,
            headers: next.headers,
            // Skip the offline interceptor during replay
            _skipOfflineQueue: true,
          } as Parameters<typeof api.request>[0] & { _skipOfflineQueue?: boolean });

          await mutationQueue.dequeue(next.id);
        } catch (err: unknown) {
          const axiosErr = err as { response?: { status: number; data?: unknown }; request?: unknown };

          if (axiosErr.response?.status === 409) {
            await mutationQueue.markConflict(next.id, axiosErr.response.data);
          } else if (!axiosErr.response) {
            // Network error — stop replay
            break;
          } else {
            // Other server error — dequeue to avoid infinite loop
            await mutationQueue.dequeue(next.id);
          }
        }

        next = await mutationQueue.peek();
      }
    } finally {
      replayingRef.current = false;
      await refreshState();
    }
  }, [refreshState]);

  // Auto-replay when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0) {
      replayQueue();
    }
  }, [isOnline, queueCount, replayQueue]);

  const resolveConflict = useCallback(
    async (id: string, action: 'use-server' | 'use-mine' | 'skip') => {
      if (action === 'use-server' || action === 'skip') {
        if (action === 'use-server') {
          await mutationQueue.dequeue(id);
        }
        // 'skip' leaves it in the queue as-is
      } else if (action === 'use-mine') {
        const all = await mutationQueue.getAll();
        const item = all.find((m) => m.id === id);
        if (item) {
          await mutationQueue.dequeue(id);
          await mutationQueue.queue({
            method: item.method,
            url: item.url,
            data: item.data,
            headers: item.headers,
          });
        }
      }
      await refreshState();
    },
    [refreshState],
  );

  return { isOnline, queueCount, conflicts, replayQueue, resolveConflict, refreshState };
}
