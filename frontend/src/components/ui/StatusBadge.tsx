import { STATUS_COLORS } from '../../utils/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status.toUpperCase()] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
  };

  const label =
    status === 'PENDING_APPROVAL'
      ? 'Awaiting Approval'
      : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${className}`}
    >
      {label}
    </span>
  );
}
