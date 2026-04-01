import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Visibility-aware polling hook.
 * Stops refetching when the tab is not visible.
 */
export function useSmartQuery<TData, TError = Error>(
  options: UseQueryOptions<TData, TError> & { pollingInterval: number },
) {
  const { pollingInterval, ...queryOptions } = options;
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return useQuery<TData, TError>({
    ...queryOptions,
    refetchInterval: visible ? pollingInterval : false,
  });
}
