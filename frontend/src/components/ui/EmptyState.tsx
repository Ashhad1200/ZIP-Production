import { InboxIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  message = 'No data available',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      {icon ?? <InboxIcon size={48} strokeWidth={1.5} />}
      <p className="mt-3 text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
